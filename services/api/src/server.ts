import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient, Role, ContentStatus, PaymentStatus, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '1mb' }));

const secret = process.env.JWT_SECRET || 'dev-only-change-me';
if (secret === 'dev-only-change-me' && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production');

type Claims = { sub: string; role: Role };
function signToken(u: { id: string; role: Role }) { return jwt.sign({ sub: u.id, role: u.role }, secret, { expiresIn: '2h' }); }
function auth(roles?: Role[]) {
  return async (req: Request & { user?: Claims }, res: Response, next: NextFunction) => {
    try {
      const h = req.headers.authorization || '';
      const t = h.startsWith('Bearer ') ? h.slice(7) : '';
      const p = jwt.verify(t, secret) as Claims;
      if (roles && !roles.includes(p.role)) return res.status(403).json({ error: 'Forbidden' });
      req.user = p; next();
    } catch { res.status(401).json({ error: 'Unauthorized' }); }
  };
}

const safeUser = (u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role, language: u.language });

app.get('/health', (_req, res) => res.json({ ok: true, service: 'mwalimu-hub-ke-api', version: '0.2.0' }));

app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const b = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(2), language: z.enum(['en','sw']).default('en') }).parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: b.email.toLowerCase() } });
    if (exists) return res.status(409).json({ error: 'Email already registered' });
    const user = await prisma.user.create({ data: { email: b.email.toLowerCase(), passwordHash: await bcrypt.hash(b.password, 12), name: b.name, role: Role.LEARNER, language: b.language } });
    await prisma.learner.create({ data: { userId: user.id } });
    return res.status(201).json({ token: signToken(user), user: safeUser(user) });
  } catch { return res.status(400).json({ error: 'Invalid registration data' }); }
});

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const b = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: b.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(b.password, user.passwordHash))) return res.status(401).json({ error: 'Invalid credentials' });
    return res.json({ token: signToken(user), user: safeUser(user) });
  } catch { return res.status(400).json({ error: 'Invalid login data' }); }
});

app.get('/api/v1/auth/me', auth(), async (req: any, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id:true,name:true,email:true,role:true,language:true } });
  if (!u) return res.status(404).json({ error:'User not found' });
  res.json(u);
});
app.patch('/api/v1/users/me', auth(), async (req:any,res) => {
  try { const b=z.object({name:z.string().min(2).optional(),language:z.enum(['en','sw']).optional()}).parse(req.body); const u=await prisma.user.update({where:{id:req.user.sub},data:b,select:{id:true,name:true,email:true,role:true,language:true}}); res.json(u); }
  catch { res.status(400).json({error:'Invalid profile data'}); }
});
app.post('/api/v1/users/change-password', auth(), async(req:any,res)=>{
  try { const b=z.object({currentPassword:z.string(),newPassword:z.string().min(8)}).parse(req.body); const u=await prisma.user.findUnique({where:{id:req.user.sub}}); if(!u||!(await bcrypt.compare(b.currentPassword,u.passwordHash))) return res.status(400).json({error:'Current password is incorrect'}); await prisma.user.update({where:{id:u.id},data:{passwordHash:await bcrypt.hash(b.newPassword,12)}}); res.json({ok:true}); }
  catch { res.status(400).json({error:'Invalid password data'}); }
});

app.get('/api/v1/curricula', auth(), async (_req,res) => res.json(await prisma.curriculum.findMany({ include:{levels:{include:{subjects:{include:{topics:true}}}}} })));
app.get('/api/v1/classes/:id', auth(), async(req,res)=>{ const c=await prisma.class.findUnique({where:{id:req.params.id},include:{subjects:{include:{subject:true}},learners:{include:{user:{select:{id:true,name:true,email:true}}}}}}); if(!c)return res.status(404).json({error:'Class not found'}); res.json(c); });
app.get('/api/v1/topics/:id/lessons', auth(), async(req,res)=>res.json(await prisma.lesson.findMany({where:{topicId:req.params.id,status:ContentStatus.PUBLISHED},orderBy:{createdAt:'asc'}})));
app.get('/api/v1/lessons/:id', auth(), async(req,res)=>{ const l=await prisma.lesson.findFirst({where:{id:req.params.id,status:ContentStatus.PUBLISHED},include:{topic:{include:{subject:true}}}}); if(!l)return res.status(404).json({error:'Lesson not found'}); res.json(l); });
app.post('/api/v1/lessons/:id/complete', auth([Role.LEARNER]), async(req:any,res)=>{ const learner=await prisma.learner.findUnique({where:{userId:req.user.sub}}); const lesson=await prisma.lesson.findFirst({where:{id:req.params.id,status:ContentStatus.PUBLISHED}}); if(!learner||!lesson)return res.status(404).json({error:'Not found'}); res.json(await prisma.progress.upsert({where:{learnerId_lessonId:{learnerId:learner.id,lessonId:lesson.id}},create:{learnerId:learner.id,lessonId:lesson.id,completed:true,percent:100},update:{completed:true,percent:100}})); });
app.get('/api/v1/learners/me/progress',auth([Role.LEARNER]),async(req:any,res)=>{ const l=await prisma.learner.findUnique({where:{userId:req.user.sub},include:{progress:{include:{lesson:true},orderBy:{updatedAt:'desc'}}}}); res.json(l?.progress??[]); });
app.get('/api/v1/learners/me/certificates',auth([Role.LEARNER]),async(req:any,res)=>{ const l=await prisma.learner.findUnique({where:{userId:req.user.sub}}); res.json(l?await prisma.certificate.findMany({where:{learnerId:l.id},orderBy:{issuedAt:'desc'}}):[]); });

app.get('/api/v1/quizzes/:id',auth(),async(req,res)=>{ const q=await prisma.quiz.findUnique({where:{id:req.params.id},include:{questions:{select:{id:true,text:true,options:true}}}}); if(!q)return res.status(404).json({error:'Quiz not found'}); res.json(q); });
app.post('/api/v1/quizzes/:id/attempts',auth([Role.LEARNER]),async(req:any,res)=>{ try { const b=z.object({answers:z.record(z.string(),z.string())}).parse(req.body); const learner=await prisma.learner.findUnique({where:{userId:req.user.sub}}); const quiz=await prisma.quiz.findUnique({where:{id:req.params.id},include:{questions:true}}); if(!learner||!quiz)return res.status(404).json({error:'Quiz not found'}); let correct=0; for(const q of quiz.questions) if(b.answers[q.id]===q.answer) correct++; const score=quiz.questions.length?Math.round(correct/quiz.questions.length*10000)/100:0; const attempt=await prisma.quizAttempt.create({data:{learnerId:learner.id,quizId:quiz.id,score}}); res.status(201).json({id:attempt.id,score,correct,total:quiz.questions.length}); } catch { res.status(400).json({error:'Invalid quiz submission'}); } });
app.get('/api/v1/learners/me/results',auth([Role.LEARNER]),async(req:any,res)=>{ const l=await prisma.learner.findUnique({where:{userId:req.user.sub}}); res.json(l?await prisma.quizAttempt.findMany({where:{learnerId:l.id},include:{quiz:true},orderBy:{submittedAt:'desc'}}):[]); });

app.get('/api/v1/notifications',auth(),async(req:any,res)=>res.json(await prisma.notification.findMany({where:{userId:req.user.sub},orderBy:{createdAt:'desc'},take:100})));
app.post('/api/v1/notifications/:id/read',auth(),async(req:any,res)=>{const n=await prisma.notification.updateMany({where:{id:req.params.id,userId:req.user.sub},data:{read:true}}); if(!n.count)return res.status(404).json({error:'Notification not found'}); res.json({ok:true});});

app.get('/api/v1/subscription',auth(),async(req:any,res)=>res.json(await prisma.subscription.findFirst({where:{userId:req.user.sub},orderBy:{createdAt:'desc'}})));
app.get('/api/v1/subscription/history',auth(),async(req:any,res)=>res.json(await prisma.payment.findMany({where:{userId:req.user.sub},orderBy:{createdAt:'desc'}})));
app.post('/api/v1/subscription/checkout',auth(),async(req:any,res)=>{ try { const b=z.object({phone:z.string().regex(/^254\d{9}$/)}).parse(req.body); const p=await prisma.payment.create({data:{userId:req.user.sub,amount:250,status:PaymentStatus.PENDING,provider:'MPESA'} }); res.status(202).json({paymentId:p.id,status:'PENDING',phone:b.phone,message:'STK Push adapter is ready to be connected to Daraja credentials.'}); } catch { res.status(400).json({error:'Use a valid Safaricom number in 254XXXXXXXXX format'}); }});

app.get('/api/v1/admin/users',auth([Role.ADMIN]),async(_req,res)=>res.json(await prisma.user.findMany({select:{id:true,name:true,email:true,role:true,createdAt:true},orderBy:{createdAt:'desc'},take:200})));
app.get('/api/v1/admin/analytics',auth([Role.ADMIN]),async(_req,res)=>{const [users,lessons,quizzes,attempts,premium,payments]=await Promise.all([prisma.user.count(),prisma.lesson.count({where:{status:ContentStatus.PUBLISHED}}),prisma.quiz.count(),prisma.quizAttempt.count(),prisma.subscription.count({where:{status:{in:[SubscriptionStatus.ACTIVE,SubscriptionStatus.EXPIRING]}}}),prisma.payment.count({where:{status:PaymentStatus.SUCCESSFUL}})]);res.json({users,lessons,quizzes,attempts,premium,successfulPayments:payments});});
app.post('/api/v1/admin/content/:id/publish',auth([Role.ADMIN]),async(req,res)=>{const l=await prisma.lesson.update({where:{id:req.params.id},data:{status:ContentStatus.PUBLISHED}});res.json(l);});

app.use((_req,res)=>res.status(404).json({error:'Route not found'}));
app.use((err:any,_req:Request,res:Response,_next:NextFunction)=>{console.error(err);res.status(500).json({error:'Internal server error'});});

const port=Number(process.env.PORT||4000);
app.listen(port,()=>console.log(`Mwalimu Hub KE API listening on ${port}`));
process.on('SIGINT',async()=>{await prisma.$disconnect();process.exit(0)});

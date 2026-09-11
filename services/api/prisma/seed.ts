import { PrismaClient, Role, ContentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe_12345!';
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mwalimuhub.ke' },
    update: {},
    create: { email: 'admin@mwalimuhub.ke', name: 'Mwalimu Hub Admin', role: Role.ADMIN, passwordHash: await bcrypt.hash(adminPassword, 12) }
  });
  const curriculum = await prisma.curriculum.upsert({ where:{id:'seed-cbc'}, update:{}, create:{id:'seed-cbc',name:'Kenya CBC/CBE Starter Curriculum'} });
  const level = await prisma.level.upsert({ where:{id:'seed-grade-7'}, update:{}, create:{id:'seed-grade-7',name:'Grade 7',curriculumId:curriculum.id} });
  const subject = await prisma.subject.upsert({ where:{id:'seed-math'}, update:{}, create:{id:'seed-math',name:'Mathematics',levelId:level.id} });
  const topic = await prisma.topic.upsert({ where:{id:'seed-numbers'}, update:{}, create:{id:'seed-numbers',name:'Numbers',subjectId:subject.id} });
  const lesson = await prisma.lesson.upsert({ where:{id:'seed-lesson-1'}, update:{status:ContentStatus.PUBLISHED}, create:{id:'seed-lesson-1',titleEn:'Introduction to Integers',titleSw:'Utangulizi wa Nambari Kamili',bodyEn:'Integers include positive numbers, negative numbers and zero. On a number line, values increase as you move to the right.',bodySw:'Nambari kamili zinajumuisha nambari chanya, hasi na sifuri. Kwenye mstari wa nambari, thamani huongezeka unaposogea kulia.',topicId:topic.id,status:ContentStatus.PUBLISHED} });
  const quiz = await prisma.quiz.upsert({ where:{id:'seed-quiz-1'}, update:{}, create:{id:'seed-quiz-1',title:'Integers Quick Quiz',subjectId:subject.id} });
  await prisma.question.upsert({ where:{id:'seed-q1'}, update:{}, create:{id:'seed-q1',quizId:quiz.id,text:'Which number is an integer?',options:['2.5','-4','1/2','√2'],answer:'-4'} });
  console.log(`Seeded admin ${admin.email}, lesson ${lesson.id}, quiz ${quiz.id}`);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());

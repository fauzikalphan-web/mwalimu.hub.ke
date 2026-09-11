import 'package:flutter/material.dart';
import '../../core/network/api_client.dart';
import 'lessons_page.dart';

class CurriculumPage extends StatefulWidget {
  const CurriculumPage({super.key, required this.api});
  final ApiClient api;
  @override State<CurriculumPage> createState() => _CurriculumPageState();
}
class _CurriculumPageState extends State<CurriculumPage> {
  List<dynamic> curricula=[]; bool loading=true;
  @override void initState(){super.initState(); _load();}
  Future<void> _load() async { try { curricula=await widget.api.get('/curricula') as List<dynamic>; } catch (_) {} if(mounted)setState(()=>loading=false); }
  @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Curriculum')),body:loading?const Center(child:CircularProgressIndicator()):RefreshIndicator(onRefresh:_load,child:ListView(padding:const EdgeInsets.all(16),children:[const Text('Choose your curriculum',style:TextStyle(fontSize:24,fontWeight:FontWeight.bold)),const SizedBox(height:8),const Text('Explore subjects, topics and lessons.'),const SizedBox(height:16),...curricula.map((c)=>Card(child:ExpansionTile(title:Text(c['name']??'Curriculum'),children:[...((c['levels']??[]) as List).map((l)=>ExpansionTile(title:Text(l['name']??'Level'),children:[...((l['subjects']??[]) as List).map((s)=>ListTile(leading:const Icon(Icons.book),title:Text(s['name']??'Subject'),subtitle:Text('${((s['topics']??[]) as List).length} topics'), onTap:()=>showModalBottomSheet(context:context,builder:(_)=>ListView(children:[...((s['topics']??[]) as List).map((t)=>ListTile(title:Text(t['name']??'Topic'),onTap:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>LessonsPage(api:widget.api,topic:t)))))]))))]))])))])));
}

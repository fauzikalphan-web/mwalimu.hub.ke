import 'package:flutter/material.dart';
import '../../core/network/api_client.dart';

class LessonsPage extends StatefulWidget { const LessonsPage({super.key, required this.api, required this.topic}); final ApiClient api; final dynamic topic; @override State<LessonsPage> createState()=>_LessonsPageState(); }
class _LessonsPageState extends State<LessonsPage>{ List<dynamic> lessons=[]; bool loading=true; @override void initState(){super.initState(); _load();} Future<void> _load() async { try{ lessons=await widget.api.get('/topics/${widget.topic['id']}/lessons') as List<dynamic>; }catch(_){ } if(mounted)setState(()=>loading=false); }
@override Widget build(BuildContext c)=>Scaffold(appBar:AppBar(title:Text(widget.topic['name']??'Lessons')),body:loading?const Center(child:CircularProgressIndicator()):RefreshIndicator(onRefresh:_load,child:ListView.builder(itemCount:lessons.length,itemBuilder:(_,i){final l=lessons[i];return Card(child:ListTile(leading:const Icon(Icons.menu_book),title:Text(l['title']??'Lesson'),subtitle:Text(l['summary']??'Open lesson'),onTap:()=>showDialog(context:c,builder:(_)=>AlertDialog(title:Text(l['title']??'Lesson'),content:SingleChildScrollView(child:Text(l['content']??'Content unavailable')),actions:[TextButton(onPressed:()=>Navigator.pop(c),child:const Text('Close'))])));})))); }
}

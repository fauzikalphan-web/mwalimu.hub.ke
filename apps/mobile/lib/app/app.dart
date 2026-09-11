import 'package:flutter/material.dart';
import '../features/auth/login_page.dart';

class MwalimuHubApp extends StatelessWidget {
  const MwalimuHubApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Mwalimu Hub KE', debugShowCheckedModeBanner: false,
    theme: ThemeData(useMaterial3:true, colorSchemeSeed:Colors.indigo, fontFamily:'Roboto', scaffoldBackgroundColor:const Color(0xFFF7F9FC)),
    home: const LoginPage(),
  );
}

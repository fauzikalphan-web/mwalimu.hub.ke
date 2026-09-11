import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  ApiClient({this.baseUrl = 'http://10.0.2.2:4000/api/v1'});
  final String baseUrl;
  String? token;

  Future<Map<String,dynamic>> post(String path, Map<String,dynamic> body) async {
    final r = await http.post(Uri.parse('$baseUrl$path'), headers:{'Content-Type':'application/json', if(token!=null)'Authorization':'Bearer $token'}, body:jsonEncode(body));
    final data = r.body.isEmpty ? <String,dynamic>{} : jsonDecode(r.body) as Map<String,dynamic>;
    if(r.statusCode >= 400) throw Exception(data['error'] ?? 'Request failed');
    return data;
  }
  Future<dynamic> get(String path) async {
    final r=await http.get(Uri.parse('$baseUrl$path'),headers:{if(token!=null)'Authorization':'Bearer $token'});
    final data=r.body.isEmpty?null:jsonDecode(r.body);
    if(r.statusCode>=400) throw Exception(data is Map?data['error']:'Request failed');
    return data;
  }
}

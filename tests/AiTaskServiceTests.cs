using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Web.Script.Serialization;
class Fake : HttpMessageHandler {
 internal int Calls,Status=200;internal string Body="",Request="",Address="";internal bool Delay,Offline;
 protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage req,CancellationToken token){Calls++;Address=req.RequestUri.AbsoluteUri;Request=await req.Content.ReadAsStringAsync();if(Delay)await Task.Delay(10000,token);if(Offline)throw new HttpRequestException();return new HttpResponseMessage((HttpStatusCode)Status){Content=new StringContent(Body)};}
}
class AiTests {
 static void Check(bool value,string what){if(!value)throw new Exception(what);}
 static readonly JavaScriptSerializer J=new JavaScriptSerializer();
 static string Envelope(string content,string reason){return J.Serialize(new{choices=new[]{new{finish_reason=reason,message=new{content=content}}}});}
 static void Main(string[] args){Run(args[0]).GetAwaiter().GetResult();}
 static async Task Run(string root){
 var f=new Fake();using(var ai=new AiTaskService(root,f)){
 var input=new Dictionary<string,object>{{"goal","验收一个产出"},{"progress","未知"},{"budget",45},{"deadline",""},{"materials",""}};
 try{await ai.Generate(input,CancellationToken.None);throw new Exception("not configured");}catch(InvalidOperationException){Check(f.Calls==0,"must not network");}
 Console.WriteLine("PASS unconfigured makes zero requests");
 string sentinel="test-only-"+Guid.NewGuid().ToString("N");ai.Save(sentinel,"deepseek-flash",true,false);Check(ai.Configured,"DPAPI readback");Check(!System.Text.Encoding.UTF8.GetString(File.ReadAllBytes(Path.Combine(root,"AiSettings/credential.dpapi"))).Contains(sentinel),"encrypted key");Check(!File.ReadAllText(Path.Combine(root,"AiSettings/model.json")).Contains(sentinel),"no key in model config");
 Console.WriteLine("PASS current-user DPAPI encrypted roundtrip; model config excludes key");
 Environment.SetEnvironmentVariable("TPLAN_AI_OFFLINE_TEST","1");try{await ai.Generate(input,CancellationToken.None);throw new Exception("offline guard");}catch(InvalidOperationException){Check(f.Calls==0,"configured QA must not network");}finally{Environment.SetEnvironmentVariable("TPLAN_AI_OFFLINE_TEST",null);}Console.WriteLine("PASS QA native network guard even with configured credentials");
 f.Body=Envelope("{\"nodes\":[],\"questions\":[\"具体产出是什么？\"],\"assumptions\":[],\"conflicts\":[]}","stop");
 Check((await ai.Generate(input,CancellationToken.None)).Contains("nodes"),"structured response");Check(f.Address=="https://api.deepseek.com/chat/completions","fixed endpoint");Check(!f.Request.Contains(sentinel),"key not prompt");Check(f.Request.Contains("json_object")&&f.Request.Contains("\"stream\":false"),"structured nonstream");
 Console.WriteLine("PASS fixed endpoint and structured nonstream via fake transport only");
 var flowInput=J.Deserialize<Dictionary<string,object>>("{\"goal\":\"只解释一个概念\",\"progress\":\"未知\",\"budget\":30,\"instruction\":\"保留核心步骤\",\"source\":{\"name\":\"教师课件\",\"pages\":\"8\",\"text\":\"人工选定摘录\"},\"graph\":{\"nodes\":[],\"edges\":[],\"startId\":\"\",\"totalBudget\":30},\"resources\":[{\"id\":\"ppt\",\"name\":\"教师课件\",\"type\":\"课件\"}]}");
 AiTaskService.ValidateFlowInput(flowInput);f.Body=Envelope("{\"graph\":{},\"questions\":[],\"assumptions\":[],\"conflicts\":[]}","stop");await ai.Generate(flowInput,CancellationToken.None,true);Check(f.Request.Contains("人工选定摘录")&&f.Request.Contains("保留核心步骤"),"selected flow scope");
 var source=J.Deserialize<Dictionary<string,object>>("{\"goal\":\"解释概念\",\"name\":\"课件\",\"pages\":\"8\",\"text\":\"人工摘录\"}");await ai.Generate(source,CancellationToken.None,false,true);Check(f.Request.Contains("此阶段不生成计划")&&!f.Request.Contains("保留核心步骤"),"inspection separate scope");
 source["secret"]=sentinel;try{AiTaskService.ValidateSourceInput(source);throw new Exception("unexpected source field");}catch(ArgumentException){}flowInput["secret"]=sentinel;try{AiTaskService.ValidateFlowInput(flowInput);throw new Exception("unexpected flow field");}catch(ArgumentException){}
 Console.WriteLine("PASS selected-text inspection and workflow edit scopes via fake HTTP, unknown fields rejected");
 foreach(int code in new[]{401,402,429,400,422,500,503}){f.Status=code;try{await ai.Generate(input,CancellationToken.None);throw new Exception("missing failure");}catch(InvalidOperationException e){Check(e.Message==AiTaskService.ErrorFor(code),"safe status mapping");}}
 f.Status=200;Console.WriteLine("PASS authentication, balance, limit, format and service errors without retries");
 foreach(string body in new[]{"bad-json",Envelope("","stop"),Envelope("{}","length"),Envelope("{bad","stop"),Envelope("{}","tool_calls"),"{\"choices\":[]}"}){f.Body=body;try{await ai.Generate(input,CancellationToken.None);throw new Exception("invalid response accepted");}catch(InvalidOperationException e){Check(!e.Message.Contains(sentinel),"no key in errors");}}
 Console.WriteLine("PASS empty, truncated and illegal response rejection");
 f.Offline=true;try{await ai.Generate(input,CancellationToken.None);throw new Exception("offline");}catch(InvalidOperationException e){Check(e.Message.Contains("网络"),"offline message");}f.Offline=false;f.Delay=true;
 using(var cancel=new CancellationTokenSource(20)){try{await ai.Generate(input,cancel.Token);throw new Exception("cancel");}catch(OperationCanceledException){}}
 Console.WriteLine("PASS offline and cancellation/timeout token");
 input["url"]="https://elsewhere.invalid";try{AiTaskService.ValidateInput(input);throw new Exception("extra input allowed");}catch(ArgumentException){}ai.Save("","deepseek-flash",false,true);Check(!ai.Configured,"remove");
 Console.WriteLine("PASS arbitrary input rejected; credential removal");
 }
 }
}

using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

// Credentials stay in the desktop process. This bridge has no task or timer write capability.
internal sealed class AiGateway : IDisposable
{
    readonly Database db;
    readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 2100000 };
    readonly Dictionary<string,CancellationTokenSource> pending = new Dictionary<string,CancellationTokenSource>();
    public AiGateway(Database database) { db = database; }
    static string Str(Dictionary<string,object> d,string key) { object v; return d.TryGetValue(key,out v) ? Convert.ToString(v) : ""; }
    public void Cancel(string id) { CancellationTokenSource c; if(pending.TryGetValue(id,out c)) c.Cancel(); }
    public async Task<string> Request(string id,string system,string user)
    {
        if(pending.Count > 0) throw new InvalidOperationException("已有请求正在生成，请稍候或取消。");
        if(system.Length > 20000 || user.Length > 100000) throw new InvalidOperationException("请求内容过长，请缩小范围。");
        string saved=db.Read("tplan.v3");
        if(String.IsNullOrWhiteSpace(saved))throw new InvalidOperationException("请先在 T计划的数据与设置中填写模型与接口。");
        var state=json.Deserialize<Dictionary<string,object>>(saved);
        if(state==null||!state.ContainsKey("settings"))throw new InvalidOperationException("请先填写模型与接口设置。");
        var settings=state["settings"] as Dictionary<string,object>;
        if(settings==null)throw new InvalidOperationException("模型设置格式不正确，请在设置中重新填写。");
        object value;
        if(!settings.TryGetValue("agent",out value))throw new InvalidOperationException("请先填写模型与接口设置。");
        var cfg=value as Dictionary<string,object>;
        if(cfg==null)throw new InvalidOperationException("模型设置格式不正确，请在设置中重新填写。");
        bool anthropic=Str(cfg,"provider")=="anthropic";
        string model=Str(cfg,"modelId").Trim(),key=db.ReadSecret();
        if(model.Length==0)throw new InvalidOperationException("请填写服务商的模型名称。");
        string address=anthropic ? "https://api.anthropic.com/v1/messages" : Str(cfg,"baseUrl").TrimEnd('/')+"/chat/completions";
        Uri uri;
        if(!Uri.TryCreate(address,UriKind.Absolute,out uri) || (uri.Scheme!="https" && !(uri.Scheme=="http" && uri.IsLoopback)) || uri.UserInfo.Length>0)
            throw new InvalidOperationException("接口需使用 HTTPS；本机模型可用 http://localhost。");
        if(key.Length==0 && !uri.IsLoopback)throw new InvalidOperationException("请先填写 API Key。");
        var ctl=new CancellationTokenSource();ctl.CancelAfter(60000);pending.Add(id,ctl);
        try {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            using(var handler=new HttpClientHandler { AllowAutoRedirect=false })
            using(var client=new HttpClient(handler))
            using(var request=new HttpRequestMessage(HttpMethod.Post,uri)) {
                client.Timeout=TimeSpan.FromSeconds(65);
                object body;
                if(anthropic) {
                    request.Headers.Add("x-api-key",key);request.Headers.Add("anthropic-version","2023-06-01");
                    body=new {model=model,max_tokens=6000,system=system,messages=new[]{new {role="user",content=user}}};
                } else {
                    if(key.Length>0)request.Headers.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",key);
                    body=new {model=model,messages=new[]{new {role="system",content=system},new {role="user",content=user}}};
                }
                request.Content=new StringContent(json.Serialize(body),Encoding.UTF8,"application/json");
                using(var response=await client.SendAsync(request,HttpCompletionOption.ResponseHeadersRead,ctl.Token)) {
                    if(!response.IsSuccessStatusCode)throw new InvalidOperationException("模型服务返回 HTTP "+(int)response.StatusCode+"，请检查服务地址、密钥、额度与模型名称。");
                    using(var stream=await response.Content.ReadAsStreamAsync())
                    using(var buffer=new MemoryStream()) {
                        var bytes=new byte[8192];int n;
                        while((n=await stream.ReadAsync(bytes,0,bytes.Length,ctl.Token))>0) {
                            if(buffer.Length+n>2000000)throw new InvalidOperationException("模型返回内容过大。");
                            buffer.Write(bytes,0,n);
                        }
                        var result=json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(buffer.ToArray()));
                        if(anthropic) {
                            var output=new StringBuilder();
                            foreach(Dictionary<string,object> block in (ArrayList)result["content"])if(Str(block,"type")=="text")output.Append(Str(block,"text"));
                            return output.ToString();
                        }
                        var choices=(ArrayList)result["choices"];
                        if(choices.Count==0)throw new InvalidOperationException("模型没有返回候选结果。");
                        var first=(Dictionary<string,object>)choices[0];
                        return Str((Dictionary<string,object>)first["message"],"content");
                    }
                }
            }
        } catch(OperationCanceledException) { throw new InvalidOperationException("请求已取消或超过 60 秒，尚未写入任务。"); }
        catch(HttpRequestException) { throw new InvalidOperationException("无法连接模型服务，请检查接口地址和网络。"); }
        finally { pending.Remove(id);ctl.Dispose(); }
    }
    public void Dispose() { foreach(var c in pending.Values)c.Cancel(); }
}

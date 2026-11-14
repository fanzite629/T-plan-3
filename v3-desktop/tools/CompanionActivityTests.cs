using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Web.Script.Serialization;
static class CompanionActivityTests
{
    static readonly List<string> checks=new List<string>();
    static void Check(bool value,string message){if(!value)throw new Exception(message);checks.Add(message);Console.WriteLine("PASS "+message);}
    static int Main(string[] args){try{
        var a=new CompanionActivity("invalid",true,0);Check(a.Current=="idle"&&a.FollowTimer,"legacy defaults keep original idle with automatic timer following enabled");
        Check(a.UpdateTimer("running",0)&&a.Current=="study","starting a timer enters study");
        int frame=a.Frame(1100);Check(frame>0&&!a.UpdateTimer("running",1100)&&a.Frame(1100)==frame,"repeated timer snapshots do not reset the writing loop");
        Check(a.UpdateTimer("paused",1200)&&a.Current=="rest","pausing enters rest");
        Check(a.UpdateTimer("running",1300)&&a.Current=="study","resuming re-enters study");
        Check(a.UpdateTimer("due",1400)&&a.Current=="rest","countdown expiry enters rest");
        a.UpdateTimer("running",1500);a.UpdateTimer("ended",1600);a.UpdateTimer("ready",1700);Check(a.Current=="rest","ending and then saving or discarding the record keeps rest");
        a.Choose("read",1800);a.UpdateTimer("ready",2000);Check(a.Current=="read","manual reading survives unchanged timer snapshots");
        a.UpdateTimer("running",2100);Check(a.Current=="study","next timer transition takes over a manual choice while following is enabled");
        a.Follow(false,2200);a.Choose("read",2200);a.UpdateTimer("paused",2300);a.UpdateTimer("running",2400);Check(a.Current=="read","disabling automatic following keeps the chosen action across timer transitions");
        a.Follow(true,2500);Check(a.Current=="study","re-enabling following immediately reconciles the current timer");
        a.Choose("rest",2600);a.UpdateTimer("garbage",2700);a.Choose("garbage",2800);Check(a.Current=="rest","invalid activity and phase values cannot replace the current action");
        var saved=new CompanionActivity("read",false,0);saved.UpdateTimer("running",0);Check(saved.Current=="read"&&!saved.FollowTimer,"saved manual activity and disabled follow preference restore together");
        bool all=true;foreach(string name in new[]{"study","read","rest"}){a.Choose(name,0);var frames=new HashSet<int>();for(int t=0;t<10000;t+=10)frames.Add(a.Frame(t));all&=frames.Count==4&&a.Frame(-1)==0;}Check(all,"each action visits all four frames and tolerates a clock value before its start");
        a.Choose("read",10000);Check(a.Frame(10000)==0,"switching actions starts at the first pose");
        var restored=new CompanionActivity("idle",true,0);restored.UpdateTimer("paused",0);Check(restored.Current=="rest","restored paused timer enters rest on the first real snapshot");
        string root=Path.GetFullPath(args[0]),dir=Path.Combine(root,"v3-desktop","output","activity");Directory.CreateDirectory(dir);string hash;using(var sha=SHA256.Create())hash=BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(Path.Combine(root,"v3-desktop","CompanionActivity.cs")))).Replace("-","").ToLowerInvariant();File.WriteAllText(Path.Combine(dir,"core-results.json"),new JavaScriptSerializer().Serialize(new{checks=checks,errors=new string[0],activitySourceSha256=hash}));return 0;
    }catch(Exception e){Console.Error.WriteLine(e);return 1;}}
}

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Security.Cryptography;
using System.Web.Script.Serialization;

static class CompanionMotionTests
{
    static readonly List<string> checks=new List<string>();
    static void Assert(bool ok,string message){if(!ok)throw new Exception(message);}
    static void Pass(string text){checks.Add(text);Console.WriteLine("PASS "+text);}
    static string Hash(byte[] bytes){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();}
    static Bitmap Render(Image original,Image eyes,double breath,bool blink){var b=new Bitmap(640,800,PixelFormat.Format32bppArgb);using(var g=Graphics.FromImage(b)){g.Clear(Color.Transparent);g.InterpolationMode=InterpolationMode.HighQualityBicubic;CompanionMotion.DrawIdle(g,original,eyes,new RectangleF(64,32,512,768),breath,blink);}return b;}
    static int Bottom(Bitmap b){for(int y=b.Height-1;y>=0;y--)for(int x=0;x<b.Width;x++)if(b.GetPixel(x,y).A>100)return y;return -1;}
    static int Main(string[] args){try{string root=Path.GetFullPath(args[0]),assets=Path.Combine(root,"v3-desktop","companion-assets"),outDir=Path.Combine(root,"v3-desktop","output","motion");Directory.CreateDirectory(outDir);
        Assert(Hash(File.ReadAllBytes(Path.Combine(assets,"original.png")))=="5f0f9f29c9858d087e1637a0de182c1a5f609bf3b509feddb7316e85b0f5417c","Original artwork changed");Pass("original artwork is byte-identical to the supplied reference");
        var m=new CompanionMotion(7);m.Sample(0,0,0,360,true);Assert(!m.Walking&&!m.Blinking&&m.BreathPixels==0,"initial pose");Pass("initial idle starts at the original standing pose without a jump");
        m.Sample(2100,0,0,360,true);Assert(Math.Abs(m.BreathPixels-1.35)<.00001,"breath peak");m.Sample(4200,0,0,360,true);Assert(Math.Abs(m.BreathPixels)<.00001,"breath loop");Pass("breathing has bounded amplitude and returns smoothly to its start");
        m=new CompanionMotion(11);bool seenBlink=false,seenOpenAfter=false;int consecutive=0,maxClosed=0;for(int t=0;t<18000;t+=10){m.Sample(t,0,0,360,true);if(m.Blinking){seenBlink=true;maxClosed=Math.Max(maxClosed,++consecutive);}else{if(seenBlink)seenOpenAfter=true;consecutive=0;}}Assert(seenBlink&&seenOpenAfter&&maxClosed==15,"blink schedule");Pass("natural blink scheduler closes for 150 ms and reopens between blinks");
        m.Sample(18000,0,0,360,false);m.Sample(23000,0,0,360,false);Assert(!m.Blinking&&m.BreathPixels==0,"disabled idle");Pass("idle motion can be disabled without altering the original pose");
        var frames=new HashSet<int>();for(int i=0;i<50;i++){m.Sample(24000+i*40,4,0,360,true);frames.Add(m.Frame);}Assert(m.Walking&&m.FacingRight&&frames.Count==8,"walking frames");Pass("actual rightward displacement traverses all eight gait frames");
        m.Sample(27000,-4,0,360,true);Assert(m.Walking&&!m.FacingRight&&!m.Blinking&&m.BreathPixels==0,"left gait");Pass("turning left selects its independently drawn assets and suppresses idle motion");
        m.Sample(27100,0,0,360,true);Assert(!m.Walking&&m.Frame==0&&m.BreathPixels==0,"blocked target");Pass("stopping or hitting a boundary returns to idle instead of walking in place");
        var a=new CompanionMotion(2);var b=new CompanionMotion(2);for(int i=0;i<40;i++){a.Sample(i*40,6,0,360,true);b.Sample(i*80,4,0,240,true);Assert(a.Frame==b.Frame,"distance scale");}Pass("gait follows actual distance and character size, independently of timer frequency");
        foreach(string direction in new[]{"left","right"}){var hashes=new HashSet<string>();for(int i=0;i<8;i++){string p=Path.Combine(assets,"walk-"+direction+"-"+i.ToString("00")+".png");hashes.Add(Hash(File.ReadAllBytes(p)));using(var im=new Bitmap(p)){Assert(im.Width==640&&im.Height==800,"registered dimensions");Assert(Math.Abs(Bottom(im)-777)<=2,"foot registration");for(int y=0;y<im.Height;y++)Assert(im.GetPixel(0,y).A==0&&im.GetPixel(im.Width-1,y).A==0,"clipped silhouette");}}Assert(hashes.Count==8,"duplicate frames");}Pass("both gait sheets contain eight distinct full-detail frames on a common foot baseline");
        using(var original=new Bitmap(Path.Combine(assets,"original.png")))using(var eyes=new Bitmap(Path.Combine(assets,"blink-eyes.png")))using(var open=Render(original,eyes,0,false))using(var closed=Render(original,eyes,0,true))using(var inhale=Render(original,eyes,1.35,true)){
            int changed=0;for(int y=0;y<open.Height;y++)for(int x=0;x<open.Width;x++)if(open.GetPixel(x,y)!=closed.GetPixel(x,y)){changed++;Assert(x>=250&&x<=410&&y>=165&&y<=252,"blink changed non-eye pixels at "+x+","+y+" "+open.GetPixel(x,y)+" -> "+closed.GetPixel(x,y));}Assert(changed>200,"blink not visible");Pass("blink changes only eye-region pixels; the rest of the rendered original is identical");
            Assert(Math.Abs(Bottom(open)-Bottom(inhale))<=1,"breathing moves feet");Pass("breathing preserves the ground-contact anchor");
            open.Save(Path.Combine(outDir,"idle-open.png"),ImageFormat.Png);closed.Save(Path.Combine(outDir,"idle-blink.png"),ImageFormat.Png);inhale.Save(Path.Combine(outDir,"idle-inhale.png"),ImageFormat.Png);
        }
        File.WriteAllText(Path.Combine(outDir,"core-results.json"),new JavaScriptSerializer().Serialize(new {checks=checks,errors=new string[0],motionSourceSha256=Hash(File.ReadAllBytes(Path.Combine(root,"v3-desktop","CompanionMotion.cs")))}));return 0;
    }catch(Exception ex){Console.Error.WriteLine(ex);return 1;}}
}

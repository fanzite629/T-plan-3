using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Security.Cryptography;
using System.Web.Script.Serialization;
static class CompanionBlendTests
{
    static readonly List<string> checks=new List<string>();
    static void Check(bool value,string text){if(!value)throw new Exception(text);checks.Add(text);Console.WriteLine("PASS "+text);}
    static Bitmap Solid(Color color,int size){var b=new Bitmap(size,size,PixelFormat.Format32bppPArgb);using(var g=Graphics.FromImage(b))g.Clear(color);return b;}
    static bool Same(Bitmap a,Bitmap b){if(a.Size!=b.Size)return false;for(int y=0;y<a.Height;y++)for(int x=0;x<a.Width;x++)if(a.GetPixel(x,y)!=b.GetPixel(x,y))return false;return true;}
    static string Hash(string path){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-","").ToLowerInvariant();}
    static int Main(string[] args){try{
        using(var red=Solid(Color.Red,4))using(var blue=Solid(Color.Blue,4))using(var green=Solid(Color.Lime,4))using(var clear=Solid(Color.Transparent,4))using(var mix=Solid(Color.Transparent,4))using(var blend=new CompanionBlend()){
            Check(Same(blend.Render(red,"idle",0),red)&&!blend.Active,"first appearance is exactly the selected artwork without a fade from blank");
            Check(Same(blend.Render(blue,"study",100),red)&&blend.Active&&blend.Progress==0,"a new action begins at the last displayed pixels without a pose jump");
            var middle=blend.Render(blue,"study",280).GetPixel(1,1);Check(middle.A==255&&Math.Abs(middle.R-128)<=1&&Math.Abs(middle.B-128)<=1,"mid-transition preserves opacity and interpolates premultiplied colors correctly");
            using(var visible=new Bitmap(blend.Image)){Check(Same(blend.Render(green,"read",280),visible),"interrupting a transition starts from the visible composite rather than the old endpoint");}
            Check(Same(blend.Render(green,"read",640),green)&&!blend.Active,"transition reaches the exact target artwork and releases its source");
            blend.Render(red,"rest",700);blend.Render(red,"rest",800);double p=blend.Progress;blend.Render(blue,"rest",850);Check(blend.Progress>p&&blend.From=="read","new loop frames within one action do not restart its transition");
            blend.Render(red,"walk-left",900);Check(blend.Active&&CompanionBlend.Duration("walk-left","study")==240,"walking has a short dedicated enter and exit blend");
            using(var larger=Solid(Color.Red,8)){Check(Same(blend.Render(larger,"study",1000),larger)&&!blend.Active,"resizing discards old-size transition surfaces without cropping");}
            blend.Mix(red,clear,mix,.5);var edge=mix.GetPixel(2,2);Check(Math.Abs(edge.A-128)<=1&&edge.R>=254&&edge.G==0&&edge.B==0,"transparent edges retain their color instead of acquiring black fringes");
            blend.Mix(red,blue,mix,0);bool start=Same(mix,red);blend.Mix(red,blue,mix,1);Check(start&&Same(mix,blue),"frame interpolation endpoints are pixel-identical to the existing source images");
            Check(Same(red,SolidReference(Color.Red))&&Same(blue,SolidReference(Color.Blue)),"mixing never mutates source artwork");
        }
        var activity=new CompanionActivity("study",true,0);Check(activity.FrameMix(0)==0&&activity.FrameMix(800)>0&&activity.FrameMix(849)>.99&&activity.FrameMix(850)==0&&activity.Frame(850)==1,"writing frames blend into their successor and keep a continuous boundary");
        activity.Choose("read",0);Check(activity.FrameMix(1000)==0&&activity.FrameMix(2199)>.99,"reading retains a readable pause before a softened page turn");
        activity.Choose("rest",0);Check(activity.Frame(4199)==3&&activity.FrameMix(4199)>.99&&activity.Frame(4200)==0&&activity.FrameMix(4200)==0,"the rest loop blends its last pose back into its first");
        var travel=new CompanionTravel();Point position=Point.Empty,target=new Point(160,0);double first=0,peak=0;bool safe=true;for(int t=0;t<5000&&position!=target;t+=16){Point previous=position;position=travel.Advance(position,target,16,360);if(t==16)first=travel.Speed;peak=Math.Max(peak,travel.Speed);safe&=position.X>=previous.X&&position.X<=target.X&&position.Y==0;}Check(safe&&position==target&&travel.Speed==0&&first<peak*.4,"walking accelerates from rest, reaches its target and never overshoots");
        travel.Reset();position=new Point(150,50);target=new Point(-45,-80);for(int t=0;t<5000&&position!=target;t+=16)position=travel.Advance(position,target,16,240);Check(position==target,"fractional displacement converges on diagonal targets at small size");
        travel.Advance(Point.Empty,new Point(500,0),80,480);travel.Reset();Check(travel.Speed==0&&travel.Advance(Point.Empty,Point.Empty,16,360)==Point.Empty,"explicit stopping and an already reached edge clear movement immediately");
        Check(CompanionBlend.Ease(-1)==0&&CompanionBlend.Ease(2)==1&&CompanionBlend.Ease(.01)<.001,"transition easing has bounded progress and gentle starts");
        string root=Path.GetFullPath(args[0]),dir=Path.Combine(root,"v3-desktop","output","smooth");Directory.CreateDirectory(dir);Check(Hash(Path.Combine(root,"v3-desktop","companion-assets","original.png"))=="5f0f9f29c9858d087e1637a0de182c1a5f609bf3b509feddb7316e85b0f5417c","the original full-detail reference remains byte-identical");
        File.WriteAllText(Path.Combine(dir,"core-results.json"),new JavaScriptSerializer().Serialize(new{checks=checks,errors=new string[0],blendSourceSha256=Hash(Path.Combine(root,"v3-desktop","CompanionBlend.cs"))}));return 0;
    }catch(Exception ex){Console.Error.WriteLine(ex);return 1;}}
    static Bitmap SolidReference(Color c){return Solid(c,4);}
}

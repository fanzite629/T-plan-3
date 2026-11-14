using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

// Monotonic animation clock, independent of task data and model requests.
// Walking is driven by distance actually moved, never by an idle/blocked target.
internal sealed class CompanionMotion
{
    readonly Random random;
    double gait, idleSince, nextBlink, blinkUntil;
    bool initialized;
    internal bool Walking {get;private set;}
    internal bool FacingRight {get;private set;}
    internal bool Blinking {get;private set;}
    internal int Frame {get;private set;}
    internal double FrameMix {get{return Walking?(gait*8-Frame):0;}}
    internal double BreathPixels {get;private set;}
    internal CompanionMotion(int seed){random=new Random(seed);FacingRight=true;}
    internal void Sample(double now,double dx,double dy,int height,bool idleEnabled)
    {
        double distance=Math.Sqrt(dx*dx+dy*dy);
        if(!initialized){initialized=true;ResetIdle(now);}
        if(distance>.01){
            if(Math.Abs(dx)>.01)FacingRight=dx>0;
            if(!Walking)gait=0;
            Walking=true;gait=(gait+distance/Math.Max(1,height*.34))%1;Frame=(int)(gait*8);
            Blinking=false;BreathPixels=0;return;
        }
        if(Walking){Walking=false;Frame=0;ResetIdle(now);}
        if(!idleEnabled){ResetIdle(now);Blinking=false;BreathPixels=0;return;}
        if(now>=nextBlink){blinkUntil=now+150;nextBlink=now+3800+random.Next(2400);}
        Blinking=now<blinkUntil;
        BreathPixels=height/360.0*1.35*(1-Math.Cos(2*Math.PI*(now-idleSince)/4200))/2;
    }
    void ResetIdle(double now){idleSince=now;blinkUntil=0;nextBlink=now+3200+random.Next(1800);}
    internal string Key(int wave){return Walking?"walk-"+(FacingRight?"right-":"left-")+Frame:wave>=0?"wave-"+wave:"idle-"+Blinking+"-"+Math.Round(BreathPixels*10);}

    // The head/upper body translate as one piece during breathing; facial geometry is not stretched.
    // Only the lower section interpolates back to the unchanged foot anchor.
    internal static void DrawIdle(Graphics g,Image original,Image eyes,RectangleF rect,double breath,bool blink)
    {
        float rise=(float)breath;
        if(rise<.001f)g.DrawImage(original,rect);
        else{
            float cut=original.Height*.64f,cutHeight=rect.Height*.64f;
            using(var attributes=new ImageAttributes()){
                attributes.SetWrapMode(WrapMode.TileFlipXY);
                g.DrawImage(original,new[]{new PointF(rect.X,rect.Y-rise),new PointF(rect.Right,rect.Y-rise),new PointF(rect.X,rect.Y+cutHeight-rise)},new RectangleF(0,0,original.Width,cut),GraphicsUnit.Pixel,attributes);
                g.DrawImage(original,new[]{new PointF(rect.X,rect.Y+cutHeight-rise),new PointF(rect.Right,rect.Y+cutHeight-rise),new PointF(rect.X,rect.Bottom)},new RectangleF(0,cut,original.Width,original.Height-cut),GraphicsUnit.Pixel,attributes);
            }
        }
        if(blink){
            var state=g.Save();float sx=rect.Width/original.Width,sy=rect.Height/original.Height;
            using(var clip=new GraphicsPath()){
                clip.AddRectangle(new RectangleF(rect.X+380*sx,rect.Y-rise+324*sy,148*sx,108*sy));
                clip.AddRectangle(new RectangleF(rect.X+530*sx,rect.Y-rise+273*sy,146*sx,118*sy));
                g.SetClip(clip,CombineMode.Intersect);g.DrawImage(eyes,new RectangleF(rect.X,rect.Y-rise,rect.Width,rect.Height));
            }
            g.Restore(state);
        }
    }
}

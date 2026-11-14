using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

// Blend premultiplied pixels once: source-over double drawing would make opaque
// facial pixels translucent at the midpoint. No artwork is regenerated or warped.
internal sealed class CompanionBlend : IDisposable
{
    Bitmap current,origin;
    string group="";
    double began,duration;
    byte[] a,b,c;
    internal bool Active {get{return origin!=null;}}
    internal double Progress {get;private set;}
    internal string From {get;private set;}
    internal string To {get{return group;}}
    internal Bitmap Image {get{return current;}}
    internal static double Ease(double t){t=Math.Max(0,Math.Min(1,t));return t*t*(3-2*t);}
    internal static double Duration(string from,string to){return from.StartsWith("walk")||to.StartsWith("walk")?240:from=="wave"||to=="wave"?220:360;}
    internal Bitmap Render(Bitmap target,string next,double now)
    {
        if(current==null||current.Size!=target.Size){Reset();current=Copy(target);group=next;Progress=1;From=next;return current;}
        if(group!=next){if(origin!=null)origin.Dispose();origin=Copy(current);From=group;duration=Duration(group,next);group=next;began=now;Progress=0;}
        Progress=origin==null?1:Math.Max(0,Math.Min(1,(now-began)/duration));
        if(origin!=null&&Progress>=1){origin.Dispose();origin=null;}
        if(origin==null)CopyPixels(target,current);else Mix(origin,target,current,Ease(Progress));
        return current;
    }
    static Bitmap Copy(Bitmap image){return image.Clone(new Rectangle(Point.Empty,image.Size),PixelFormat.Format32bppPArgb);}
    internal void Mix(Bitmap first,Bitmap second,Bitmap destination,double amount)
    {
        if(first.Size!=second.Size||first.Size!=destination.Size)throw new ArgumentException("Blend canvases must have equal dimensions");
        int length=first.Width*first.Height*4;if(a==null||a.Length!=length){a=new byte[length];b=new byte[length];c=new byte[length];}
        Read(first,a);Read(second,b);int weight=(int)Math.Round(Math.Max(0,Math.Min(1,amount))*65536),inverse=65536-weight;
        for(int i=0;i<length;i++)c[i]=(byte)((a[i]*inverse+b[i]*weight+32768)>>16);Write(destination,c);
    }
    static void Read(Bitmap image,byte[] pixels){var data=image.LockBits(new Rectangle(Point.Empty,image.Size),ImageLockMode.ReadOnly,PixelFormat.Format32bppPArgb);try{Marshal.Copy(data.Scan0,pixels,0,pixels.Length);}finally{image.UnlockBits(data);}}
    static void Write(Bitmap image,byte[] pixels){var data=image.LockBits(new Rectangle(Point.Empty,image.Size),ImageLockMode.WriteOnly,PixelFormat.Format32bppPArgb);try{Marshal.Copy(pixels,0,data.Scan0,pixels.Length);}finally{image.UnlockBits(data);}}
    void CopyPixels(Bitmap source,Bitmap destination){int length=source.Width*source.Height*4;if(c==null||c.Length!=length)c=new byte[length];Read(source,c);Write(destination,c);}
    internal void Reset(){if(current!=null)current.Dispose();if(origin!=null)origin.Dispose();current=null;origin=null;group="";From="";Progress=1;}
    public void Dispose(){Reset();a=null;b=null;c=null;}
}

// Fractional motion plus acceleration/braking. Gait still advances from the real
// native window displacement, while subpixel carry prevents low-speed stuttering.
internal sealed class CompanionTravel
{
    double speed,carryX,carryY;
    internal double Speed {get{return speed;}}
    internal void Reset(){speed=carryX=carryY=0;}
    internal Point Advance(Point position,Point target,double milliseconds,int height)
    {
        double dx=target.X-position.X,dy=target.Y-position.Y,distance=Math.Sqrt(dx*dx+dy*dy);
        if(distance<.5){Reset();return target;}
        double dt=Math.Max(0,Math.Min(80,milliseconds))/1000,maxSpeed=height*.36,acceleration=maxSpeed/.18;
        double desired=Math.Min(maxSpeed,Math.Sqrt(2*acceleration*distance)),old=speed;
        speed+=Math.Max(-acceleration*dt,Math.Min(acceleration*dt,desired-speed));
        double step=(old+speed)*.5*dt;if(step>=distance){Reset();return target;}
        double x=dx/distance*step+carryX,y=dy/distance*step+carryY;int ix=(int)Math.Round(x),iy=(int)Math.Round(y);carryX=x-ix;carryY=y-iy;
        if(ix*dx+iy*dy>=distance*distance){Reset();return target;}
        return new Point(position.X+ix,position.Y+iy);
    }
}

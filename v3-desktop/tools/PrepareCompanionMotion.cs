using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

// Mechanical sprite import only: equal-cell extraction, alpha cleanup and registration.
// Character artwork and blink eyelids are supplied by imagegen, not drawn here.
static class PrepareCompanionMotion
{
    static byte[] Pixels(Bitmap b){var d=b.LockBits(new Rectangle(0,0,b.Width,b.Height),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);var p=new byte[b.Width*b.Height*4];Marshal.Copy(d.Scan0,p,0,p.Length);b.UnlockBits(d);return p;}
    static Bitmap BitmapOf(byte[] p,int w,int h){var b=new Bitmap(w,h,PixelFormat.Format32bppArgb);var d=b.LockBits(new Rectangle(0,0,w,h),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);Marshal.Copy(p,0,d.Scan0,p.Length);b.UnlockBits(d);return b;}
    static Bitmap Clean(Bitmap b){var p=Pixels(b);int w=b.Width,h=b.Height;for(int k=3;k<p.Length;k+=4)p[k]=(byte)Math.Max(0,Math.Min(255,(p[k]-200)*255/52));
        var visited=new bool[w*h];var queue=new List<int>();
        for(int n=0;n<w*h;n++){if(visited[n]||p[n*4+3]==0)continue;queue.Clear();queue.Add(n);visited[n]=true;for(int i=0;i<queue.Count;i++){int a=queue[i],x=a%w,y=a/w;foreach(int next in new[]{x>0?a-1:-1,x<w-1?a+1:-1,y>0?a-w:-1,y<h-1?a+w:-1})if(next>=0&&!visited[next]&&p[next*4+3]>0){visited[next]=true;queue.Add(next);}}if(queue.Count<18)foreach(int q in queue)p[q*4+3]=0;}
        return BitmapOf(p,w,h);
    }
    static Rectangle Bounds(Bitmap b){var p=Pixels(b);int x0=b.Width,y0=b.Height,x1=-1,y1=-1;for(int y=0;y<b.Height;y++)for(int x=0;x<b.Width;x++)if(p[(y*b.Width+x)*4+3]>0){x0=Math.Min(x0,x);x1=Math.Max(x1,x);y0=Math.Min(y0,y);y1=Math.Max(y1,y);}if(x1<0)throw new Exception("Empty sprite");return Rectangle.FromLTRB(x0,y0,x1+1,y1+1);}
    static double Gray(byte[] p,int w,int x,int y){int i=(y*w+x)*4;return p[i]*.114+p[i+1]*.587+p[i+2]*.299;}
    static Point Register(Bitmap reference,Bitmap frame,Rectangle face){var a=Pixels(reference);var b=Pixels(frame);double best=-2;Point shift=Point.Empty;
        for(int dy=-18;dy<=18;dy++)for(int dx=-18;dx<=18;dx++){double sa=0,sb=0,saa=0,sbb=0,sab=0,count=0;for(int y=face.Top;y<face.Bottom;y+=2)for(int x=face.Left;x<face.Right;x+=2){double va=Gray(a,reference.Width,x,y),vb=Gray(b,frame.Width,x+dx,y+dy);sa+=va;sb+=vb;saa+=va*va;sbb+=vb*vb;sab+=va*vb;count++;}double score=(sab-sa*sb/count)/Math.Sqrt(Math.Max(1,(saa-sa*sa/count)*(sbb-sb*sb/count)));if(score>best){best=score;shift=new Point(dx,dy);}}
        return shift;
    }
    static void Walk(string input,string output,string direction,int faceX,Rectangle face){using(var sheet=new Bitmap(input)){
        if(sheet.Width%4!=0||sheet.Height%2!=0)throw new Exception("Expected exact 4 by 2 sheet");int w=sheet.Width/4,h=sheet.Height/2;var frames=new Bitmap[8];var bounds=new Rectangle[8];var shifts=new Point[8];
        try{int maxHeight=0;for(int i=0;i<8;i++){using(var cell=sheet.Clone(new Rectangle(i%4*w,i/4*h,w,h),PixelFormat.Format32bppArgb))frames[i]=Clean(cell);bounds[i]=Bounds(frames[i]);maxHeight=Math.Max(maxHeight,bounds[i].Height);if(bounds[i].Left==0||bounds[i].Right==w)Console.WriteLine("EDGE WARNING "+direction+" "+i+" "+bounds[i]);}
            for(int i=0;i<8;i++)shifts[i]=i==0?Point.Empty:Register(frames[0],frames[i],face);
            float scale=746f/maxHeight;for(int i=0;i<8;i++){float left=330-(faceX+shifts[i].X)*scale,top=778-bounds[i].Bottom*scale;using(var result=new Bitmap(640,800,PixelFormat.Format32bppArgb))using(var g=Graphics.FromImage(result)){g.Clear(Color.Transparent);g.CompositingMode=CompositingMode.SourceCopy;g.InterpolationMode=InterpolationMode.HighQualityBicubic;using(var attr=new ImageAttributes()){attr.SetWrapMode(WrapMode.TileFlipXY);g.DrawImage(frames[i],new Rectangle((int)Math.Round(left),(int)Math.Round(top),(int)Math.Round(w*scale),(int)Math.Round(h*scale)),0,0,w,h,GraphicsUnit.Pixel,attr);}var resultBounds=Bounds(result);if(resultBounds.Left<2||resultBounds.Right>638||resultBounds.Top<0||resultBounds.Bottom>780)throw new Exception("Normalized sprite clipped: "+direction+" "+i+" "+resultBounds);result.Save(Path.Combine(output,"walk-"+direction+"-"+i.ToString("00")+".png"),ImageFormat.Png);Console.WriteLine(direction+" "+i+" anchorOffset="+shifts[i]+" bounds="+resultBounds);}}
        }finally{foreach(var b in frames)if(b!=null)b.Dispose();}
    }}
    static double EyeMask(double x,double y,double cx,double cy,double rx,double ry){double r=Math.Sqrt(Math.Pow((x-cx)/rx,2)+Math.Pow((y-cy)/ry,2));return Math.Max(0,Math.Min(1,(1-r)/.12));}
    static void Blink(string original,string edited,string output,string proof){using(var source=new Bitmap(edited))using(var basis=new Bitmap(original)){
        if(source.Size!=basis.Size)throw new Exception("Blink edit must retain original dimensions");var p=Pixels(source);
        for(int y=0;y<source.Height;y++)for(int x=0;x<source.Width;x++){double mask=Math.Max(EyeMask(x,y,454,378,70,49),EyeMask(x,y,603,332,69,55));p[(y*source.Width+x)*4+3]=(byte)Math.Round(p[(y*source.Width+x)*4+3]*mask);}
        using(var eyes=BitmapOf(p,source.Width,source.Height)){eyes.Save(Path.Combine(output,"blink-eyes.png"),ImageFormat.Png);using(var preview=new Bitmap(basis))using(var g=Graphics.FromImage(preview)){g.DrawImageUnscaled(eyes,0,0);preview.Save(Path.Combine(proof,"blink-composite.png"),ImageFormat.Png);}}
    }}
    static int Main(string[] args){try{string root=Path.GetFullPath(args[0]);string assets=Path.Combine(root,"v3-desktop","companion-assets"),raw=Path.Combine(root,"designs","companion-motion-20261114","generated"),proof=Path.Combine(root,"v3-desktop","output","motion");Directory.CreateDirectory(proof);
        Walk(Path.Combine(raw,"walk-right.png"),assets,"right",219,new Rectangle(185,110,65,65));Walk(Path.Combine(raw,"walk-left.png"),assets,"left",155,new Rectangle(112,95,66,66));Blink(Path.Combine(assets,"original.png"),Path.Combine(raw,"blink-source.png"),assets,proof);return 0;
    }catch(Exception ex){Console.Error.WriteLine(ex);return 1;}}
}

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

// Mechanical import of generated artwork: cut equal cells, remove transparent
// residue, register a common ground line. No face/body illustration is drawn here.
static class PrepareCompanionActivities
{
    static byte[] Pixels(Bitmap b){var d=b.LockBits(new Rectangle(0,0,b.Width,b.Height),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);var p=new byte[b.Width*b.Height*4];Marshal.Copy(d.Scan0,p,0,p.Length);b.UnlockBits(d);return p;}
    static Bitmap Clean(Bitmap b){var p=Pixels(b);int w=b.Width,h=b.Height;for(int k=3;k<p.Length;k+=4)p[k]=(byte)Math.Max(0,Math.Min(255,(p[k]-200)*255/52));
        var seen=new bool[w*h];var q=new List<int>();for(int n=0;n<w*h;n++){if(seen[n]||p[n*4+3]==0)continue;q.Clear();q.Add(n);seen[n]=true;for(int i=0;i<q.Count;i++){int a=q[i],x=a%w,y=a/w;foreach(int z in new[]{x>0?a-1:-1,x<w-1?a+1:-1,y>0?a-w:-1,y<h-1?a+w:-1})if(z>=0&&!seen[z]&&p[z*4+3]>0){seen[z]=true;q.Add(z);}}if(q.Count<18)foreach(int z in q)p[z*4+3]=0;}
        var result=new Bitmap(w,h,PixelFormat.Format32bppArgb);var d=result.LockBits(new Rectangle(0,0,w,h),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);Marshal.Copy(p,0,d.Scan0,p.Length);result.UnlockBits(d);return result;
    }
    static Rectangle Bounds(Bitmap b){var p=Pixels(b);int l=b.Width,t=b.Height,r=-1,bt=-1;for(int y=0;y<b.Height;y++)for(int x=0;x<b.Width;x++)if(p[(y*b.Width+x)*4+3]>0){l=Math.Min(l,x);r=Math.Max(r,x);t=Math.Min(t,y);bt=Math.Max(bt,y);}if(r<0)throw new Exception("Empty frame");return Rectangle.FromLTRB(l,t,r+1,bt+1);}
    static double Gray(byte[] p,int w,int x,int y){int k=(y*w+x)*4;return p[k]*.114+p[k+1]*.587+p[k+2]*.299;}
    static int AlignX(Bitmap basis,Bitmap frame,Rectangle body,int groundDelta){var a=Pixels(basis);var b=Pixels(frame);double best=-2;int shift=0;
        for(int dy=groundDelta-4;dy<=groundDelta+4;dy++)for(int dx=-60;dx<=60;dx++){double sa=0,sb=0,saa=0,sbb=0,sab=0,n=0;for(int y=body.Top;y<body.Bottom;y+=3)for(int x=body.Left;x<body.Right;x+=3){int xx=x+dx,yy=y+dy;if(xx<0||xx>=frame.Width||yy<0||yy>=frame.Height||a[(y*basis.Width+x)*4+3]<200||b[(yy*frame.Width+xx)*4+3]<200)continue;double va=Gray(a,basis.Width,x,y),vb=Gray(b,frame.Width,xx,yy);sa+=va;sb+=vb;saa+=va*va;sbb+=vb*vb;sab+=va*vb;n++;}if(n<100)continue;double score=(sab-sa*sb/n)/Math.Sqrt(Math.Max(1,(saa-sa*sa/n)*(sbb-sb*sb/n)));if(score>best){best=score;shift=dx;}}
        return shift;
    }
    static void Import(string input,string output,string name){using(var sheet=new Bitmap(input)){
        if(sheet.Width%2!=0||sheet.Height%2!=0)throw new Exception("Expected a 2x2 sheet");int w=sheet.Width/2,h=sheet.Height/2;var frames=new Bitmap[4];var boxes=new Rectangle[4];var shifts=new int[4];int left=w,right=0,maxHeight=0;
        try{for(int i=0;i<4;i++){using(var cell=sheet.Clone(new Rectangle(i%2*w,i/2*h,w,h),PixelFormat.Format32bppArgb))frames[i]=Clean(cell);boxes[i]=Bounds(frames[i]);Console.WriteLine(name+" source "+i+" "+boxes[i]);if(boxes[i].Left<2||boxes[i].Top<2||boxes[i].Right>w-2||boxes[i].Bottom>h-2)throw new Exception("Source touches a cell boundary: "+name+" "+i);left=Math.Min(left,boxes[i].Left);right=Math.Max(right,boxes[i].Right);maxHeight=Math.Max(maxHeight,boxes[i].Height);}
            var anchor=new Rectangle(boxes[0].Left+(int)(boxes[0].Width*.25),boxes[0].Top+(int)(boxes[0].Height*.62),(int)(boxes[0].Width*.50),(int)(boxes[0].Height*.28));left=w;right=0;
            for(int i=0;i<4;i++){shifts[i]=i==0?0:AlignX(frames[0],frames[i],anchor,boxes[i].Bottom-boxes[0].Bottom);left=Math.Min(left,boxes[i].Left-shifts[i]);right=Math.Max(right,boxes[i].Right-shifts[i]);Console.WriteLine(name+" anchor shift "+i+" "+shifts[i]);}
            float scale=Math.Min(740f/maxHeight,600f/(right-left)),x=320-(left+right)*.5f*scale;
            for(int i=0;i<4;i++)using(var result=new Bitmap(640,800,PixelFormat.Format32bppArgb))using(var g=Graphics.FromImage(result)){
                g.Clear(Color.Transparent);g.CompositingMode=CompositingMode.SourceCopy;g.InterpolationMode=InterpolationMode.HighQualityBicubic;
                using(var attr=new ImageAttributes()){attr.SetWrapMode(WrapMode.TileFlipXY);g.DrawImage(frames[i],new Rectangle((int)Math.Round(x-shifts[i]*scale),(int)Math.Round(778-boxes[i].Bottom*scale),(int)Math.Round(w*scale),(int)Math.Round(h*scale)),0,0,w,h,GraphicsUnit.Pixel,attr);}
                var bounds=Bounds(result);if(bounds.Left<4||bounds.Right>636||bounds.Top<20||bounds.Bottom>780)throw new Exception("Output clipped: "+bounds);result.Save(Path.Combine(output,"activity-"+name+"-"+i.ToString("00")+".png"),ImageFormat.Png);Console.WriteLine(name+" final "+i+" "+bounds);
            }
        }finally{foreach(var frame in frames)if(frame!=null)frame.Dispose();}
    }}
    static int Main(string[] args){try{string root=Path.GetFullPath(args[0]),raw=Path.Combine(root,"designs","companion-activities-20261114","generated"),assets=Path.Combine(root,"v3-desktop","companion-assets");foreach(string name in new[]{"study","read","rest"})Import(Path.Combine(raw,name+".png"),assets,name);return 0;}catch(Exception e){Console.Error.WriteLine(e);return 1;}}
}

using System;

// The timer owns facts; this controller changes only the companion's appearance.
// Manual choices last until the next timer transition when FollowTimer is enabled.
internal sealed class CompanionActivity
{
    internal string Current {get;private set;}
    internal bool FollowTimer {get;private set;}
    string phase="";
    double startedAt;
    internal CompanionActivity(string saved,bool follow,double now){Current=Valid(saved)?saved:"idle";FollowTimer=follow;startedAt=now;}
    static bool Valid(string value){return value=="idle"||value=="study"||value=="read"||value=="rest";}
    bool Set(string value,double now){if(!Valid(value)||value==Current)return false;Current=value;startedAt=now;return true;}
    internal bool Choose(string value,double now){return Set(value,now);}
    internal bool UpdateTimer(string next,double now)
    {
        if(next!="ready"&&next!="running"&&next!="paused"&&next!="due"&&next!="ended")return false;
        if(next==phase)return false;
        string previous=phase;phase=next;
        return FollowTimer&&ApplyTimer(previous,now);
    }
    bool ApplyTimer(string previous,double now)
    {
        if(phase=="running")return Set("study",now);
        if(phase=="paused"||phase=="due"||phase=="ended"||(phase=="ready"&&previous!=""&&previous!="ready"))return Set("rest",now);
        return false;
    }
    internal bool Follow(bool enabled,double now){FollowTimer=enabled;return enabled&&ApplyTimer("",now);}
    internal int Frame(double now)
    {
        int[] durations=Current=="study"?new[]{850,220,500,220}:Current=="read"?new[]{2200,350,400,250}:new[]{2000,500,1200,500};
        double t=Math.Max(0,now-startedAt);int total=0;foreach(int duration in durations)total+=duration;t%=total;
        for(int i=0;i<durations.Length;i++){if(t<durations[i])return i;t-=durations[i];}return 0;
    }
    internal double FrameMix(double now)
    {
        int[] durations=Current=="study"?new[]{850,220,500,220}:Current=="read"?new[]{2200,350,400,250}:new[]{2000,500,1200,500};
        double t=Math.Max(0,now-startedAt);int total=0;foreach(int duration in durations)total+=duration;t%=total;
        for(int i=0;i<durations.Length;i++){if(t<durations[i]){double blend=Math.Min(Current=="rest"?340:Current=="read"?240:170,durations[i]*.8);double u=Math.Max(0,Math.Min(1,(t-durations[i]+blend)/blend));return u*u*(3-2*u);}t-=durations[i];}return 0;
    }
    internal string Label {get{return Current=="study"?"学习中":Current=="read"?"看书中":Current=="rest"?"休息中":"原图待机";}}
    internal string Key(double now){return "activity-"+Current+"-"+Frame(now);}
}

import {
  Sparkles,
  MessageCircle,
} from "lucide-react";

function BackgroundEffects() {
  return (
    <div className="background-effects">

      {/* Ambient glows */}
      <div className="glow glow-one"></div>
      <div className="glow glow-two"></div>
      <div className="glow glow-three"></div>

      {/* Large floating orbs */}
      <div className="orb orb-one"></div>
      <div className="orb orb-two"></div>

      {/* Abstract floating shapes */}
    <div className="abstract-shape shape-one"></div>
    <div className="abstract-shape shape-two"></div>
    <div className="abstract-shape shape-three"></div>

      {/* Decorative rings */}
      <div className="ring ring-one"></div>
      <div className="ring ring-two"></div>

      {/* Dot patterns */}
      <div className="dots dots-left"></div>
      <div className="dots dots-right"></div>

      {/* Floating chat bubble */}
      <div className="floating-chat">
        <MessageCircle size={20} />
        <span></span>
        <span></span>
        <span></span>
      </div>


    {/* Floating profile bubbles */}
    <div className="profile-bubble profile-one">
  <span>👩🏻‍💻</span>
        </div>

        <div className="profile-bubble profile-two">
            <span>👨🏻‍🎨</span>
        </div>

        <div className="profile-bubble profile-three">
            <span>👨🏻‍💻</span>
    </div>  


      {/* Sparkles */}
      <Sparkles className="spark spark-one" size={20} />
      <Sparkles className="spark spark-two" size={16} />
      <Sparkles className="spark spark-three" size={14} />

    </div>
  );
}

export default BackgroundEffects;
import { useState, useEffect, useRef } from "react";

// ─── Constants & Geo Data ─────────────────────────────────────────────────────
const PINCODE_COORDS = {
  "700156":{ lat:22.5894, lng:88.4802, area:"Action Area I, Newtown" },
  "700157":{ lat:22.5801, lng:88.4889, area:"Action Area II, Newtown" },
  "700135":{ lat:22.6052, lng:88.4657, area:"Rajarhat Gopalpur" },
  "700161":{ lat:22.5698, lng:88.5012, area:"Action Area III, Newtown" },
  "700136":{ lat:22.6150, lng:88.4720, area:"Baguiati" },
  "700059":{ lat:22.6280, lng:88.4350, area:"Salt Lake Sector V" },
  "700091":{ lat:22.6050, lng:88.4400, area:"Salt Lake City" },
  "700105":{ lat:22.5760, lng:88.4300, area:"EM Bypass, Kasba" },
  "700107":{ lat:22.5600, lng:88.4400, area:"Gariahat" },
  "700160":{ lat:22.5950, lng:88.4900, area:"Eco Park Zone" },
};

const haversineKm = (la1,ln1,la2,ln2) => {
  const R=6371, dLat=((la2-la1)*Math.PI)/180, dLng=((ln2-ln1)*Math.PI)/180;
  const a=Math.sin(dLat/2)**2+Math.cos((la1*Math.PI)/180)*Math.cos((la2*Math.PI)/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};

const maskPhone = (p) => p ? `${String(p).slice(0,5)}•••••` : "••••••••••";

// ─── Service Types ────────────────────────────────────────────────────────────
const SVC = {
  full:{
    id:"full", label:"Full Catering Service", icon:"🍽️", minGuests:30,
    tagline:"30+ guests · Staff, cutlery & full setup included",
    color:"#f97316", grad:"linear-gradient(135deg,rgba(249,115,22,0.13),rgba(239,68,68,0.07))",
    border:"rgba(249,115,22,0.4)", btnGrad:"linear-gradient(135deg,#f97316,#ef4444)",
    accentRGB:"249,115,22",
    features:["Serving staff on-site","Cutlery, crockery & serveware","Live food counters","Setup, decoration & cleanup","Chafing dishes & buffet stands","Minimum 30 guests"],
    priceRange:{min:350,max:1800}, priceLabel:"per plate (all-inclusive)",
  },
  bulk:{
    id:"bulk", label:"Bulk Food Delivery", icon:"📦", minGuests:1,
    tagline:"Any quantity · Packed & delivered to you",
    color:"#818cf8", grad:"linear-gradient(135deg,rgba(99,102,241,0.13),rgba(139,92,246,0.07))",
    border:"rgba(99,102,241,0.4)", btnGrad:"linear-gradient(135deg,#6366f1,#8b5cf6)",
    accentRGB:"99,102,241",
    features:["No minimum order","Food packed in containers","Home/venue delivery","No staff or setup included","Disposable cutlery on request","Faster turnaround"],
    priceRange:{min:120,max:600}, priceLabel:"per portion (food only)",
  },
};

const ALL_CUISINES = ["Bengali","Mughlai","North Indian","South Indian","Continental","Chinese","Kolkata Biryani","Vegetarian Only","Jain","Punjabi","Rajasthani","Street Food","Bakery & Desserts","Multi-cuisine"];

// ─── Seed Caterer Data ────────────────────────────────────────────────────────
const SEED_CATERERS = [
  {id:"c1",name:"Bhojohori Manna Caterers",ownerName:"Subroto Das",phone:"9830012345",email:"subroto@bhojohori.in",address:"Plot 5A, Action Area I",pincode:"700156",specialty:["Wedding","Party","Religious"],cuisineSpecialties:["Bengali","Multi-cuisine"],serviceTypes:["full"],tags:["Bengali Cuisine","Multi-course"],priceRange:"₹₹₹",logo:"🪷",rating:4.8,turnaround:"2–3 hrs",registeredAt:"2024-01-10",active:true},
  {id:"c2",name:"Kolkata Dawat",ownerName:"Md. Irfan Ali",phone:"9736054321",email:"irfan@kolkatadawat.com",address:"EE-12, Action Area II",pincode:"700157",specialty:["Party","Corporate","Wedding"],cuisineSpecialties:["Mughlai","Kolkata Biryani","North Indian"],serviceTypes:["full","bulk"],tags:["Budget-friendly","Mughlai & Bengali"],priceRange:"₹₹",logo:"🍚",rating:4.6,turnaround:"1–2 hrs",registeredAt:"2024-02-05",active:true},
  {id:"c3",name:"Ananda Bhojan Events",ownerName:"Priya Chakraborty",phone:"9674011223",email:"priya@anandabhojan.com",address:"Eco Park Gate 2, Sector IV",pincode:"700160",specialty:["Wedding","Religious"],cuisineSpecialties:["Bengali","Vegetarian Only","Jain"],serviceTypes:["full"],tags:["Luxury","Live counters","Veg specialist"],priceRange:"₹₹₹₹",logo:"🎊",rating:4.9,turnaround:"3–4 hrs",registeredAt:"2024-01-22",active:true},
  {id:"c4",name:"Thakurbarir Ranna",ownerName:"Goutam Banerjee",phone:"9800167890",email:"goutam@thakurbarir.com",address:"K-7 Rajarhat Main Road",pincode:"700135",specialty:["Wedding","Religious","Party"],cuisineSpecialties:["Bengali","Vegetarian Only"],serviceTypes:["full","bulk"],tags:["Authentic Bengali","Vegetarian"],priceRange:"₹₹",logo:"🏛️",rating:4.7,turnaround:"2–3 hrs",registeredAt:"2024-03-01",active:true},
  {id:"c5",name:"Biryani & Beyond",ownerName:"Rajesh Sharma",phone:"9051022334",email:"rajesh@biryanibb.com",address:"Silicon Valley Tower 3",pincode:"700156",specialty:["Party","Corporate"],cuisineSpecialties:["Kolkata Biryani","Mughlai","North Indian"],serviceTypes:["bulk"],tags:["Kolkata Biryani","Non-veg specialist"],priceRange:"₹₹",logo:"🍖",rating:4.5,turnaround:"1–2 hrs",registeredAt:"2024-02-18",active:true},
  {id:"c6",name:"Sanmilani Grand Caterers",ownerName:"Debabrata Roy",phone:"9339044556",email:"deb@sanmilani.com",address:"New Town Connector, Block D",pincode:"700157",specialty:["Wedding","Party","Corporate","Religious"],cuisineSpecialties:["Bengali","North Indian","Continental","Multi-cuisine"],serviceTypes:["full","bulk"],tags:["Premium","Full-service","Pan-Bengali"],priceRange:"₹₹₹",logo:"👑",rating:4.8,turnaround:"2–4 hrs",registeredAt:"2024-01-30",active:true},
];

// ─── In-Memory DB ─────────────────────────────────────────────────────────────
const DB = {
  init:()=>{ if(!window.__aDB) window.__aDB={caterers:JSON.parse(JSON.stringify(SEED_CATERERS)),customers:[],quotationRequests:[],orders:[],chatOrders:[]}; },
  get:()=>{DB.init();return window.__aDB;},
  saveCaterer:(c)=>{DB.init();window.__aDB.caterers.push(c);},
  saveCustomer:(c)=>{DB.init();window.__aDB.customers.push(c);},
  saveQR:(q)=>{DB.init();window.__aDB.quotationRequests.push(q);},
  saveOrder:(o)=>{DB.init();window.__aDB.orders.push(o);},
  saveChatOrder:(o)=>{DB.init();window.__aDB.chatOrders.push(o);},
  getCaterers:()=>DB.get().caterers.filter(c=>c.active),
};

const MENU_ITEMS = {
  Starters:["Fish Fry","Veg Chop","Egg Devil","Dahi Vada","Aloo Tikki","Prawn Cocktail","Chicken Cutlet"],
  "Main Course":["Sorshe Ilish","Chingri Malai Curry","Kosha Mangsho","Dal Makhani","Paneer Butter Masala","Begun Bhaja","Mutton Curry"],
  "Bengali Specials":["Luchi-Alur Dom","Cholar Dal","Shukto","Mochar Ghonto","Dharosh Posto","Aloo Posto"],
  Breads:["Luchi","Tandoori Roti","Paratha","Naan","Puri"],
  Rice:["Steamed Rice","Kolkata Biryani","Basanti Pulao","Jeera Rice","Curd Rice"],
  Desserts:["Mishti Doi","Rasgolla","Sandesh","Payesh","Gulab Jamun","Malpua","Ice Cream Counter"],
  Beverages:["Aam Panna","Thandai","Lassi","Soft Drinks","Masala Chai","Fresh Coconut Water"],
};

const EVENT_TYPES = [
  {id:"wedding",label:"Wedding",icon:"💍",desc:"Biye, annaprasan & grand receptions"},
  {id:"party",label:"Party",icon:"🎉",desc:"Birthday, anniversary & get-togethers"},
  {id:"corporate",label:"Corporate",icon:"🏢",desc:"Office events & team lunches"},
  {id:"religious",label:"Religious",icon:"🪔",desc:"Pujo, brata & community feasts"},
];

const STEPS = ["Service","Location","Event","Guests & Budget","Menu","Quotes","Order"];
const DEMO_OTP="1234", BASE_KM=5, KM_RATE=20, WAIT_HRS=48;

const buildWAMsg = (caterer, req) => {
  const exp = new Date(new Date(req.sentAt).getTime()+WAIT_HRS*3600000);
  return encodeURIComponent(`🎉 *New Quote Request — Aayojan*\n\nHello *${caterer.ownerName}*,\n\n📋 *Request:* ${req.id}\n🛎️ *Service:* ${req.serviceType==="full"?"Full Catering Service":"Bulk Food Delivery"}\n🎊 *Event:* ${req.eventType}\n👥 *Guests:* ${req.guestCount}\n💰 *Budget:* ₹${req.perPlateBudget}/${req.serviceType==="full"?"plate":"portion"}\n📍 *Pincode:* ${req.customerPincode}\n🍽️ *Menu:* ${req.menuItems.slice(0,5).join(", ")}${req.menuItems.length>5?` +${req.menuItems.length-5} more`:""}\n\n⏰ Respond within 48 hrs · Deadline: ${exp.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}\n— Team Aayojan, Newtown Kolkata`);
};

// ─── Budget Slider Component ──────────────────────────────────────────────────
function BudgetSlider({svcType, value, onChange}) {
  const cfg = SVC[svcType];
  const {min,max} = cfg.priceRange;
  const pct = ((value-min)/(max-min))*100;
  const tier = pct<33 ? {label:"💚 Budget-friendly",color:"#4ade80"} : pct<66 ? {label:"🟠 Mid-range",color:"#f97316"} : {label:"💜 Premium",color:"#a78bfa"};
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:14}}>
        <div>
          <div style={{fontSize:13,color:"#94a3b8",marginBottom:4}}>{cfg.priceLabel}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:6}}>
            <span style={{fontSize:52,fontWeight:900,color:cfg.color,fontFamily:"'Playfair Display',serif",lineHeight:1}}>₹{value}</span>
            <span style={{fontSize:15,color:"#64748b"}}>/ {svcType==="full"?"plate":"portion"}</span>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>Range</div>
          <div style={{fontSize:13,fontWeight:700,color:tier.color}}>{tier.label}</div>
        </div>
      </div>
      <input type="range" min={min} max={max} step={10} value={value} onChange={e=>onChange(Number(e.target.value))}
        style={{width:"100%",accentColor:cfg.color,marginBottom:6}}/>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#475569",marginBottom:14}}>
        <span>₹{min} economy</span><span>₹{max} luxury</span>
      </div>
      <div style={{background:`rgba(${cfg.accentRGB},0.07)`,border:`1px solid rgba(${cfg.accentRGB},0.2)`,borderRadius:10,padding:"12px 16px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,textAlign:"center"}}>
        {[[`Per ${svcType==="full"?"plate":"portion"}`,`₹${value}`],["50 guests",`₹${(value*50).toLocaleString()}`],["100 guests",`₹${(value*100).toLocaleString()}`],["200 guests",`₹${(value*200).toLocaleString()}`]].map(([lbl,val])=>(
          <div key={lbl}><div style={{fontSize:14,fontWeight:800,color:cfg.color}}>{val}</div><div style={{fontSize:10,color:"#64748b",marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>{lbl}</div></div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Chatbot Component ─────────────────────────────────────────────────────
function AayojanChatbot({onOrderCreated, user, onLoginRequired}) {
  const [msgs, setMsgs] = useState([
    {role:"assistant", text:"নমস্কার! 🙏 I'm **Aayojan AI** — your personal catering assistant for Newtown, Kolkata!\n\nI can help you:\n• 🍽️ Build a **custom menu** for any event\n• 💰 Find caterers **within your budget**\n• 📦 Arrange **full service or bulk delivery**\n• 📋 Place a **complete catering order**\n\nTell me about your event! For example: *\"I need catering for 150 guests at a wedding in Action Area I, budget ₹600 per plate\"*"}
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

  const SYSTEM_PROMPT = `You are Aayojan AI, a friendly and expert catering assistant for Aayojan — a caterer aggregator platform serving Newtown, Kolkata and surrounding areas (Rajarhat, Salt Lake, Action Area I/II/III, Eco Park, Baguiati).

Your job is to help customers plan their catering order through natural conversation. You collect:
1. Service type: "full catering service" (30+ guests, includes staff/cutlery/setup) OR "bulk food delivery" (any quantity, packed & delivered)
2. Event type: wedding, party, corporate, religious
3. Guest count (minimum 30 for full service)
4. Per-plate/portion budget in ₹ (full service: ₹350–₹1800/plate; bulk: ₹120–₹600/portion)
5. Menu items they want (Bengali dishes, North Indian, Mughlai, etc.)
6. Location / pincode in Newtown Kolkata area

Available pincodes: 700156 (Action Area I), 700157 (Action Area II), 700135 (Rajarhat), 700161 (Action Area III), 700136 (Baguiati), 700059 (Salt Lake Sector V), 700091 (Salt Lake), 700105 (EM Bypass), 700107 (Gariahat), 700160 (Eco Park)

Popular menu items you can suggest:
- Bengali: Sorshe Ilish, Kosha Mangsho, Chingri Malai Curry, Luchi-Alur Dom, Mishti Doi, Rasgolla, Sandesh, Payesh
- Starters: Fish Fry, Veg Chop, Egg Devil, Chicken Cutlet
- Rice/Breads: Kolkata Biryani, Basanti Pulao, Luchi, Paratha
- Desserts: Gulab Jamun, Ice Cream Counter, Malpua

Be conversational, warm, and use occasional Bengali words (like "shundor", "darun", "asha kori"). Suggest menu items proactively. When you have ALL 6 pieces of info, output a JSON block at the end of your response in this exact format (after your conversational text):

###ORDER_JSON###
{"serviceType":"full","eventType":"wedding","guestCount":150,"perPlateBudget":600,"menuItems":["Sorshe Ilish","Kosha Mangsho","Luchi","Mishti Doi"],"pincode":"700156","summary":"150-guest wedding in Action Area I, ₹600/plate full service"}
###END_JSON###

Keep responses concise (2-4 sentences max) unless listing menu suggestions. If info is missing, ask ONE question at a time. Be enthusiastic and helpful!`;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMsgs = [...msgs, {role:"user", text}];
    setMsgs(newMsgs);
    setLoading(true);

    try {
      const apiMessages = newMsgs.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.text.replace(/###ORDER_JSON###[\s\S]*?###END_JSON###/g,"").trim()
      }));

      const res = await fetch(import.meta.env.VITE_API_URL || "http://localhost:8000/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          messages: apiMessages,
          system_prompt: SYSTEM_PROMPT,
        })
      });
      const data = await res.json();
      const replyText = data.reply || "Sorry, I couldn't process that. Please try again.";

      // Extract order JSON if present
      const jsonMatch = replyText.match(/###ORDER_JSON###\s*([\s\S]*?)\s*###END_JSON###/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          setOrderData(parsed);
        } catch(e){}
      }

      const cleanReply = replyText.replace(/###ORDER_JSON###[\s\S]*?###END_JSON###/g,"").trim();
      setMsgs(prev => [...prev, {role:"assistant", text:cleanReply}]);
    } catch(err) {
      setMsgs(prev => [...prev, {role:"assistant", text:"⚠️ I'm having trouble connecting right now. Please try again in a moment, or use our step-by-step booking flow."}]);
    }
    setLoading(false);
  };

  const confirmOrder = () => {
    if (!user) { onLoginRequired(); return; }
    const order = {
      id:`CHAT-${Date.now()}`,
      source:"chatbot",
      customerId: user.id,
      customerPhone: user.phone,
      ...orderData,
      status:"Quotation Requested",
      placedAt: new Date().toISOString(),
    };
    DB.saveChatOrder(order);
    onOrderCreated(order);
    setConfirmed(true);
    setMsgs(prev=>[...prev,{role:"assistant",text:`✅ **Order placed!** Your request ID is **${order.id}**.\n\nWe'll send WhatsApp quotes to up to 5 nearby caterers within the next 48 hours. You'll be contacted at ${user.phone}. Dhonnobad! 🙏`}]);
    setOrderData(null);
  };

  const renderText = (text) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((p,j) => p.startsWith('**') && p.endsWith('**')
            ? <strong key={j} style={{color:"#fff"}}>{p.slice(2,-2)}</strong>
            : <span key={j}>{p}</span>
          )}
          {i < text.split('\n').length-1 && <br/>}
        </span>
      );
    });
  };

  return (
    <div style={S.chatWrap}>
      {/* Chat header */}
      <div style={S.chatHeader}>
        <div style={S.chatBotAvatar}>🤖</div>
        <div>
          <div style={{fontWeight:700,color:"#fff",fontSize:15}}>Aayojan AI</div>
          <div style={{fontSize:12,color:"#4ade80",display:"flex",alignItems:"center",gap:5}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#4ade80",display:"inline-block"}}/>
            Online · Newtown Catering Expert
          </div>
        </div>
        <div style={{marginLeft:"auto",fontSize:11,color:"#475569",textAlign:"right"}}>
          <div>Powered by</div>
          <div style={{color:"#f97316",fontWeight:700}}>Claude AI</div>
        </div>
      </div>

      {/* Messages */}
      <div style={S.chatMessages}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:12}}>
            {m.role==="assistant" && <div style={S.botAvatarSmall}>🤖</div>}
            <div style={{
              maxWidth:"82%",
              background:m.role==="user"?"linear-gradient(135deg,#f97316,#ef4444)":"rgba(30,41,59,0.9)",
              color:m.role==="user"?"#fff":"#e2e8f0",
              borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
              padding:"11px 15px",fontSize:13,lineHeight:1.55,
              border:m.role==="assistant"?"1px solid rgba(255,255,255,0.07)":"none",
            }}>
              {renderText(m.text)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{display:"flex",gap:8,alignItems:"center",padding:"4px 0"}}>
            <div style={S.botAvatarSmall}>🤖</div>
            <div style={{background:"rgba(30,41,59,0.9)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"18px 18px 18px 4px",padding:"12px 16px",display:"flex",gap:5}}>
              {[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#64748b",animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}
            </div>
          </div>
        )}
        {/* Order confirmation card */}
        {orderData && !confirmed && (
          <div style={S.orderConfirmCard}>
            <div style={S.orderConfirmTitle}>📋 Order Summary — Ready to Submit?</div>
            <div style={S.orderConfirmGrid}>
              {[
                ["🛎️ Service", SVC[orderData.serviceType]?.label || orderData.serviceType],
                ["🎊 Event", orderData.eventType],
                ["👥 Guests", orderData.guestCount],
                ["💰 Budget", `₹${orderData.perPlateBudget}/${orderData.serviceType==="full"?"plate":"portion"}`],
                ["📍 Pincode", orderData.pincode],
                ["🍽️ Menu", `${orderData.menuItems?.length || 0} items`],
              ].map(([lbl,val])=>(
                <div key={lbl} style={S.orderConfirmRow}>
                  <span style={{color:"#64748b"}}>{lbl}</span>
                  <span style={{color:"#e2e8f0",fontWeight:600,textTransform:"capitalize"}}>{val}</span>
                </div>
              ))}
            </div>
            {orderData.menuItems?.length > 0 && (
              <div style={{display:"flex",flexWrap:"wrap",gap:5,margin:"10px 0"}}>
                {orderData.menuItems.map(item=><span key={item} style={{fontSize:11,padding:"3px 9px",borderRadius:12,background:"rgba(249,115,22,0.1)",color:"#f97316",border:"1px solid rgba(249,115,22,0.25)"}}>{item}</span>)}
              </div>
            )}
            <div style={{display:"flex",gap:10,marginTop:12}}>
              <button onClick={()=>setOrderData(null)} style={{flex:1,padding:"10px",borderRadius:9,background:"transparent",border:"1px solid #334155",color:"#94a3b8",cursor:"pointer",fontSize:13}}>Edit</button>
              <button onClick={confirmOrder} style={{flex:2,padding:"10px",borderRadius:9,background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>
                ✅ Confirm & Send to Caterers
              </button>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Quick prompts */}
      {msgs.length === 1 && (
        <div style={S.quickPrompts}>
          {["🎂 Birthday party, 50 guests","💍 Wedding reception, 200 guests","📦 Bulk delivery, 30 portions","🪔 Durga Puja feast, 100 people"].map(p=>(
            <button key={p} onClick={()=>{setInput(p);setTimeout(()=>inputRef.current?.focus(),50);}}
              style={S.quickBtn}>{p}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={S.chatInputRow}>
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()}
          placeholder="Describe your event, budget, menu preferences..."
          style={S.chatInput}/>
        <button onClick={sendMessage} disabled={!input.trim()||loading}
          style={{...S.chatSendBtn,opacity:input.trim()&&!loading?1:0.4}}>
          {loading ? "⏳" : "➤"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function AayojanApp() {
  const [view, setView] = useState("landing"); // landing | app | register | dbview | chat
  const [animIn, setAnimIn] = useState(true);

  // Auth
  const [authStage, setAuthStage] = useState("idle");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["","","",""]);
  const [otpError, setOtpError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [user, setUser] = useState(null);
  const timerRef = useRef(null);
  const otpRefs = [useRef(),useRef(),useRef(),useRef()];

  // Service + flow
  const [serviceType, setServiceType] = useState(null);
  const [step, setStep] = useState(0);
  const [customerPincode, setCustomerPincode] = useState("");
  const [pincodeError, setPincodeError] = useState("");
  const [customerCoords, setCustomerCoords] = useState(null);
  const [eventType, setEventType] = useState(null);
  const [guestCount, setGuestCount] = useState(100);
  const [perPlateBudget, setPerPlateBudget] = useState(500);
  const [selectedItems, setSelectedItems] = useState([]);
  const [customItem, setCustomItem] = useState("");
  const [nearbyCaterers, setNearbyCaterers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedCaterer, setExpandedCaterer] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [quotationRequest, setQuotationRequest] = useState(null);
  const [whatsappSent, setWhatsappSent] = useState([]);

  // Order
  const [deliveryAddress, setDeliveryAddress] = useState({flat:"",building:"",street:"",landmark:"",pincode:"",city:"Kolkata",state:"West Bengal"});
  const [addressErrors, setAddressErrors] = useState({});
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [chatOrderConfirmed, setChatOrderConfirmed] = useState(null);

  // Registration
  const [regForm, setRegForm] = useState({name:"",ownerName:"",phone:"",email:"",address:"",pincode:"",specialty:[],cuisineSpecialties:[],serviceTypes:[],priceRange:"₹₹",turnaround:"2–3 hrs"});
  const [regErrors, setRegErrors] = useState({});
  const [regSuccess, setRegSuccess] = useState(false);

  // DB view
  const [dbTab, setDbTab] = useState("caterers");
  const [dbData, setDbData] = useState({caterers:[],customers:[],quotationRequests:[],orders:[],chatOrders:[]});

  useEffect(()=>{
    DB.init();
    setAnimIn(false);
    const t=setTimeout(()=>setAnimIn(true),60);
    return()=>clearTimeout(t);
  },[view,step,authStage]);

  useEffect(()=>{
    if(serviceType) setPerPlateBudget(SVC[serviceType].priceRange.min+100);
  },[serviceType]);

  useEffect(()=>{
    if(otpTimer>0){timerRef.current=setTimeout(()=>setOtpTimer(t=>t-1),1000);}
    return()=>clearTimeout(timerRef.current);
  },[otpTimer]);

  const navigate = (v) => { setAnimIn(false); setTimeout(()=>{setView(v);setAnimIn(true);},80); };
  const anim = {opacity:animIn?1:0,transform:animIn?"translateY(0)":"translateY(18px)",transition:"opacity 0.32s ease,transform 0.32s ease"};
  const stCfg = serviceType ? SVC[serviceType] : SVC.full;
  const accent = stCfg.color;
  const accentGrad = stCfg.btnGrad;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleSendOtp = () => {
    const c = phone.replace(/\D/g,"");
    if(c.length!==10){setPhoneError("Enter a valid 10-digit mobile number.");return;}
    setPhoneError(""); setOtp(["","","",""]); setOtpError("");
    setAuthStage("otp"); setOtpTimer(30);
    setTimeout(()=>otpRefs[0].current?.focus(),150);
  };
  const handleOtpChange = (val,idx) => {
    if(!/^\d?$/.test(val)) return;
    const n=[...otp]; n[idx]=val; setOtp(n); setOtpError("");
    if(val&&idx<3) otpRefs[idx+1].current?.focus();
  };
  const handleOtpKey = (e,idx) => { if(e.key==="Backspace"&&!otp[idx]&&idx>0) otpRefs[idx-1].current?.focus(); };
  const handleVerifyOtp = () => {
    const entered=otp.join("");
    if(entered.length<4){setOtpError("Enter the 4-digit OTP.");return;}
    if(entered!==DEMO_OTP){setOtpError("Incorrect OTP. Use 1234 for demo.");return;}
    const nu={id:`cu_${Date.now()}`,phone:`+91 ${phone.slice(0,5)} ${phone.slice(5)}`,registeredAt:new Date().toISOString()};
    if(!DB.get().customers.find(c=>c.phone===phone)) DB.saveCustomer(nu);
    setUser(nu); setAuthStage("verified"); setOtpError("");
  };
  const handleResendOtp = () => { setOtp(["","","",""]); setOtpError(""); setOtpTimer(30); setTimeout(()=>otpRefs[0].current?.focus(),100); };

  // ── Pincode ───────────────────────────────────────────────────────────────
  const handlePincodeNext = () => {
    const coords=PINCODE_COORDS[customerPincode.trim()];
    if(customerPincode.trim().length!==6||!coords){setPincodeError("Enter a valid Newtown/Kolkata 6-digit pincode");return;}
    setPincodeError(""); setCustomerCoords(coords);
    const withDist=DB.getCaterers()
      .filter(c=>!serviceType||(c.serviceTypes||["full"]).includes(serviceType))
      .map(c=>{
        const cc=PINCODE_COORDS[c.pincode];
        const dist=cc?Math.round(haversineKm(coords.lat,coords.lng,cc.lat,cc.lng)*10)/10:99;
        const extraKm=Math.max(0,dist-BASE_KM);
        return {...c,distanceKm:dist,extraKm:parseFloat(extraKm.toFixed(1)),surcharge:Math.round(extraKm*KM_RATE)};
      }).sort((a,b)=>a.distanceKm-b.distanceKm);
    setNearbyCaterers(withDist); setStep(2);
  };

  // ── Generate Quotes ───────────────────────────────────────────────────────
  const generateQuotes = () => {
    if(authStage!=="verified"){setAuthStage("phone");return;}
    setLoading(true);
    setTimeout(()=>{
      const matched=nearbyCaterers
        .filter(c=>c.specialty.map(s=>s.toLowerCase()).includes(eventType))
        .slice(0,5)
        .map(c=>{
          const variance=(Math.random()-0.3)*0.3;
          const perPlateActual=Math.max(SVC[serviceType].priceRange.min,Math.round((perPlateBudget*(1+variance))/10)*10);
          const base=perPlateActual*guestCount;
          const travelFee=c.surcharge*Math.ceil(guestCount/50);
          return{...c,quoteCode:`${c.id.toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`,perPlateActual,basePrice:base,travelSurcharge:travelFee,totalPrice:base+travelFee,itemsCovered:selectedItems.length,withinBudget:perPlateActual<=perPlateBudget};
        }).sort((a,b)=>a.perPlateActual-b.perPlateActual);

      const now=new Date();
      const qr={id:`QR-${Date.now()}`,customerId:user?.id,customerPhone:user?.phone,catererIds:matched.map(c=>c.id),eventType,serviceType,guestCount,perPlateBudget,menuItems:selectedItems,customerPincode,sentAt:now.toISOString(),expiresAt:new Date(now.getTime()+WAIT_HRS*3600000).toISOString(),status:"Awaiting Responses",
        whatsappLog:matched.map(c=>({catererId:c.id,catererName:c.name,maskedPhone:maskPhone(c.phone),sentAt:now.toISOString(),status:"Sent ✅"}))};
      DB.saveQR(qr); setQuotationRequest(qr); setWhatsappSent(qr.whatsappLog);
      setQuotes(matched); setLoading(false); setStep(5);
    },1800);
  };

  // ── Order ─────────────────────────────────────────────────────────────────
  const validateAddress = () => {
    const e={};
    if(!deliveryAddress.flat.trim()) e.flat="Required";
    if(!deliveryAddress.building.trim()) e.building="Required";
    if(!deliveryAddress.street.trim()) e.street="Required";
    if(!deliveryAddress.pincode.trim()||deliveryAddress.pincode.length!==6) e.pincode="Valid 6-digit pincode required";
    setAddressErrors(e); return Object.keys(e).length===0;
  };
  const placeOrder = () => {
    if(!validateAddress()) return;
    const order={id:`ORD-${Date.now()}`,quotationRequestId:quotationRequest?.id,customerId:user?.id,customerPhone:user?.phone,catererId:selectedQuote.id,catererName:selectedQuote.name,eventType,serviceType,guestCount,perPlateBudget,perPlateActual:selectedQuote.perPlateActual,menuItems:selectedItems,
      deliveryAddress:`${deliveryAddress.flat}, ${deliveryAddress.building}, ${deliveryAddress.street}${deliveryAddress.landmark?", "+deliveryAddress.landmark:""}, ${deliveryAddress.city} - ${deliveryAddress.pincode}`,
      deliveryPincode:deliveryAddress.pincode,distanceKm:selectedQuote.distanceKm,basePrice:selectedQuote.basePrice,travelSurcharge:selectedQuote.travelSurcharge,totalPrice:selectedQuote.totalPrice,quoteCode:selectedQuote.quoteCode,status:"Confirmed",placedAt:new Date().toISOString()};
    DB.saveOrder(order); setOrderPlaced(order); setStep(6);
  };

  // ── Registration ──────────────────────────────────────────────────────────
  const validateReg = () => {
    const e={};
    if(!regForm.name.trim()) e.name="Business name required";
    if(!regForm.ownerName.trim()) e.ownerName="Owner name required";
    if(!/^\d{10}$/.test(regForm.phone)) e.phone="Valid 10-digit number required";
    if(!regForm.email.includes("@")) e.email="Valid email required";
    if(!regForm.address.trim()) e.address="Address required";
    if(!PINCODE_COORDS[regForm.pincode.trim()]) e.pincode="Valid Kolkata pincode required";
    if(regForm.specialty.length===0) e.specialty="Select at least one event specialty";
    if(regForm.cuisineSpecialties.length===0) e.cuisineSpecialties="Select at least one cuisine";
    if(regForm.serviceTypes.length===0) e.serviceTypes="Select at least one service type";
    setRegErrors(e); return Object.keys(e).length===0;
  };
  const submitRegistration = () => {
    if(!validateReg()) return;
    const logos=["🍽️","🥘","🫕","🥗","🍛","🥞","🎂"];
    DB.saveCaterer({id:`c${Date.now()}`,...regForm,pincode:regForm.pincode.trim(),logo:logos[Math.floor(Math.random()*logos.length)],tags:regForm.cuisineSpecialties.slice(0,3),rating:4.0,registeredAt:new Date().toISOString().split("T")[0],active:true});
    setRegSuccess(true);
  };

  const copyCode = (code) => { navigator.clipboard?.writeText(code); setCopiedCode(code); setTimeout(()=>setCopiedCode(null),2000); };
  const toggleItem = (item) => setSelectedItems(prev=>prev.includes(item)?prev.filter(i=>i!==item):[...prev,item]);
  const addCustomItem = () => { if(customItem.trim()&&!selectedItems.includes(customItem.trim())){setSelectedItems(prev=>[...prev,customItem.trim()]);setCustomItem("");} };
  const toggleRegCuisine = (c) => setRegForm(prev=>({...prev,cuisineSpecialties:prev.cuisineSpecialties.includes(c)?prev.cuisineSpecialties.filter(x=>x!==c):[...prev.cuisineSpecialties,c]}));
  const toggleRegSvc = (t) => setRegForm(prev=>({...prev,serviceTypes:prev.serviceTypes.includes(t)?prev.serviceTypes.filter(x=>x!==t):[...prev.serviceTypes,t]}));
  const resetApp = () => { setStep(0);setServiceType(null);setQuotes([]);setSelectedItems([]);setEventType(null);setGuestCount(100);setPerPlateBudget(500);setCustomerPincode("");setCustomerCoords(null);setSelectedQuote(null);setOrderPlaced(null);setQuotationRequest(null);setWhatsappSent([]);setDeliveryAddress({flat:"",building:"",street:"",landmark:"",pincode:"",city:"Kolkata",state:"West Bengal"}); };

  const showLoginModal = authStage==="phone"||authStage==="otp";

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div style={S.root}>
      <div style={S.bgGlow}/>

      {/* ── OTP Modal ──────────────────────────────────────────────────────── */}
      {showLoginModal && (
        <div style={S.overlay}>
          <div style={{...S.modal,...anim}}>
            <div style={{fontSize:44,marginBottom:16}}>📱</div>
            <h2 style={S.modalTitle}>{authStage==="phone"?"Login to Continue":"Enter OTP"}</h2>
            <p style={S.modalSub}>{authStage==="phone"?"Verify your mobile to send quote requests":"OTP sent to +91 "+phone.slice(0,5)+" "+phone.slice(5)}</p>
            {authStage==="phone"&&<>
              <div style={S.phoneRow}>
                <div style={S.cc}>🇮🇳 +91</div>
                <input type="tel" maxLength={10} placeholder="Mobile number" value={phone}
                  onChange={e=>{setPhone(e.target.value.replace(/\D/g,""));setPhoneError("");}}
                  onKeyDown={e=>e.key==="Enter"&&handleSendOtp()} style={S.phoneInput} autoFocus/>
              </div>
              {phoneError&&<div style={S.errMsg}>{phoneError}</div>}
              <button onClick={handleSendOtp} style={S.primaryBtn}>Send OTP →</button>
            </>}
            {authStage==="otp"&&<>
              <div style={S.otpRow}>
                {otp.map((d,i)=>(
                  <input key={i} ref={otpRefs[i]} type="tel" maxLength={1} value={d}
                    onChange={e=>handleOtpChange(e.target.value,i)} onKeyDown={e=>handleOtpKey(e,i)}
                    style={{...S.otpBox,borderColor:otpError?"#ef4444":d?"#f97316":"#334155"}}/>
                ))}
              </div>
              {otpError&&<div style={S.errMsg}>{otpError}</div>}
              <div style={S.demoBadge}>🔑 Demo OTP: <strong>1234</strong></div>
              <button onClick={handleVerifyOtp} style={S.primaryBtn}>Verify & Continue ✓</button>
              <div style={S.resendRow}>
                {otpTimer>0?<span style={{fontSize:13,color:"#475569"}}>Resend in {otpTimer}s</span>:<button onClick={handleResendOtp} style={S.linkBtn}>Resend OTP</button>}
                <button onClick={()=>{setAuthStage("phone");setOtp(["","","",""]);setOtpError("");}} style={{...S.linkBtn,color:"#64748b"}}>Change number</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={S.header}>
        <button onClick={()=>{navigate("landing");resetApp();}} style={S.logoBtn}>
          <span style={S.logoMark}>🍛</span>
          <div><div style={S.brand}>Aayojan</div><div style={S.tagline}>📍 Newtown, Kolkata</div></div>
        </button>
        <div style={S.headerRight}>
          {["app","chat"].includes(view)&&<button onClick={()=>navigate("landing")} style={S.ghostBtn}>← Home</button>}
          <button onClick={()=>{navigate("chat");}} style={{...S.ghostBtn,borderColor:"rgba(249,115,22,0.35)",color:"#f97316"}}>🤖 AI Chat</button>
          <button onClick={()=>{const d=DB.get();setDbData(d);navigate("dbview");}} style={S.ghostBtn}>🗄️ DB</button>
          {user?<div style={S.userChip}><span>✅</span><span style={{fontSize:12}}>{user.phone}</span></div>:<button onClick={()=>setAuthStage("phone")} style={S.loginBtn}>Login</button>}
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          LANDING PAGE
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="landing"&&(
        <div style={{...S.page,...anim}}>
          <div style={S.hero}>
            <div style={S.heroBadge}>📍 Serving Newtown, Kolkata & surrounding areas</div>
            <h1 style={S.heroTitle}>Welcome to <span style={S.heroAccent}>Aayojan !!</span></h1>
            <p style={S.heroSub}>Your celebration, perfectly served. Compare quotes from top-rated caterers — full service or bulk delivery.</p>
            {/* AI Chat button */}
            <div style={S.aiChatPromo}>
              <div style={S.aiChatPromoLeft}>
                <div style={{fontSize:32}}>🤖</div>
                <div>
                  <div style={{fontWeight:800,color:"#fff",fontSize:16,marginBottom:3}}>Try Aayojan AI Chatbot</div>
                  <div style={{fontSize:13,color:"#94a3b8"}}>Describe your event in plain words — our AI builds the perfect catering order for you</div>
                </div>
              </div>
              <button onClick={()=>navigate("chat")} style={{...S.heroCTA,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",flexShrink:0}}>Chat Now →</button>
            </div>
          </div>

          {/* Service type selection */}
          <div style={{marginBottom:44}}>
            <h2 style={{...S.sectionTitle,textAlign:"center",marginBottom:6}}>Or Browse by Service Type</h2>
            <p style={{textAlign:"center",color:"#64748b",fontSize:14,marginBottom:24}}>Select how you'd like your catering delivered</p>
            <div style={S.svcGrid}>
              {Object.values(SVC).map(svc=>(
                <button key={svc.id} onClick={()=>{setServiceType(svc.id);navigate("app");setStep(1);}}
                  style={{...S.svcCard,background:svc.grad,borderColor:svc.border}}>
                  <div style={{...S.svcCardIcon,background:`rgba(${svc.accentRGB},0.15)`}}>{svc.icon}</div>
                  <div style={{...S.svcCardLabel,color:svc.color}}>{svc.label}</div>
                  <div style={S.svcCardTagline}>{svc.tagline}</div>
                  <div style={S.svcFeatures}>
                    {svc.features.map(f=><div key={f} style={{...S.svcFeatureItem,color:svc.id==="full"?"#fdba74":"#a5b4fc"}}>✓ {f}</div>)}
                  </div>
                  <div style={{...S.svcCTA,background:svc.btnGrad}}>Book {svc.label} →</div>
                </button>
              ))}
            </div>
          </div>

          <div style={S.statsRow}>
            {[["🍽️",DB.getCaterers().length+"+","Caterers"],["📍","10+","Pincodes"],["⭐","4.7","Avg Rating"],["🎉","500+","Events"]].map(([icon,val,lbl])=>(
              <div key={lbl} style={S.statCard}><span style={{fontSize:24}}>{icon}</span><span style={S.statVal}>{val}</span><span style={S.statLbl}>{lbl}</span></div>
            ))}
          </div>

          <div style={S.section}>
            <h2 style={S.sectionTitle}>How It Works</h2>
            <div style={S.stepsGrid}>
              {[["🛎️","Pick Service","Full catering or bulk delivery"],["💬","Chat with AI","Tell our bot your needs naturally"],["📍","Enter Pincode","Caterers within 5 km shown first"],["📲","Get Quotes 48hrs","WhatsApp sent to top 5 caterers"]].map(([icon,title,desc],i)=>(
                <div key={i} style={S.howCard}><div style={S.howNum}>{i+1}</div><div style={{fontSize:30,marginBottom:10}}>{icon}</div><div style={S.howTitle}>{title}</div><div style={S.howDesc}>{desc}</div></div>
              ))}
            </div>
          </div>

          <div style={S.section}>
            <h2 style={S.sectionTitle}>Featured Caterers</h2>
            <div style={S.featuredGrid}>
              {DB.getCaterers().slice(0,3).map(c=>(
                <div key={c.id} style={S.featCard}>
                  <div style={S.featTop}><div style={S.featLogo}>{c.logo}</div><div><div style={S.featName}>{c.name}</div><div style={S.featMeta}>⭐{c.rating} · 📍{PINCODE_COORDS[c.pincode]?.area||c.address}</div></div></div>
                  <div style={{...S.chipRow,marginBottom:8}}>
                    {(c.serviceTypes||["full"]).map(st=><span key={st} style={{...S.chip2,color:SVC[st].color,borderColor:`rgba(${SVC[st].accentRGB},0.3)`,background:`rgba(${SVC[st].accentRGB},0.07)`}}>{SVC[st].icon} {SVC[st].label}</span>)}
                  </div>
                  <div style={S.chipRow}>{c.cuisineSpecialties?.slice(0,3).map(cs=><span key={cs} style={S.chip2}>{cs}</span>)}</div>
                  <div style={S.featPrice}>{c.priceRange}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={S.catBanner}>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#fff",marginBottom:10}}>Are you a caterer? 👨‍🍳</div>
              <div style={{fontSize:15,color:"#94a3b8",marginBottom:14,lineHeight:1.6}}>Join Aayojan and receive WhatsApp quotation requests from customers in Newtown. Register free.</div>
              {["✓ Free registration","✓ WhatsApp quote requests directly","✓ Choose Full Service or Bulk Delivery"].map(p=><div key={p} style={{fontSize:14,color:"#4ade80",marginBottom:4}}>{p}</div>)}
            </div>
            <button onClick={()=>navigate("register")} style={{...S.primaryBtn,width:"auto",marginTop:0,flexShrink:0}}>Register Your Business →</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          AI CHATBOT VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="chat"&&(
        <div style={{...S.page,...anim}}>
          <div style={{maxWidth:700,margin:"0 auto"}}>
            <div style={{textAlign:"center",marginBottom:24}}>
              <h2 style={{...S.sectionTitle,marginBottom:6}}>🤖 Aayojan AI Chatbot</h2>
              <p style={{color:"#64748b",fontSize:14}}>Describe your event in plain language — the AI will collect all details and create your catering order</p>
            </div>
            {chatOrderConfirmed?(
              <div style={{...S.card,textAlign:"center"}}>
                <div style={{fontSize:64,marginBottom:16}}>🎉</div>
                <h2 style={{...S.cardTitle,textAlign:"center"}}>Chat Order Placed!</h2>
                <div style={{background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.25)",borderRadius:14,padding:"20px",marginBottom:20}}>
                  <div style={{fontSize:22,fontWeight:900,fontFamily:"monospace",color:"#4ade80",marginBottom:12}}>{chatOrderConfirmed.id}</div>
                  {[["Service",SVC[chatOrderConfirmed.serviceType]?.label||chatOrderConfirmed.serviceType],["Event",chatOrderConfirmed.eventType],["Guests",chatOrderConfirmed.guestCount],["Budget",`₹${chatOrderConfirmed.perPlateBudget}/plate`],["Pincode",chatOrderConfirmed.pincode]].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:14}}><span style={{color:"#64748b"}}>{l}</span><span style={{color:"#e2e8f0",textTransform:"capitalize"}}>{v}</span></div>
                  ))}
                </div>
                <p style={{color:"#94a3b8",fontSize:13,marginBottom:20}}>WhatsApp quotes will be sent to up to 5 nearby caterers. You'll be contacted at <strong style={{color:"#f97316"}}>{user?.phone}</strong> within 48 hours.</p>
                <div style={{display:"flex",gap:12}}>
                  <button onClick={()=>{setChatOrderConfirmed(null);navigate("chat");}} style={S.secondaryBtn}>New Chat</button>
                  <button onClick={()=>{const d=DB.get();setDbData(d);navigate("dbview");setDbTab("chatOrders");}} style={{...S.primaryBtn,marginTop:0,flex:1}}>View in DB 🗄️</button>
                </div>
              </div>
            ):(
              <AayojanChatbot
                user={user}
                onOrderCreated={(order)=>{setChatOrderConfirmed(order);}}
                onLoginRequired={()=>setAuthStage("phone")}
              />
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CATERER REGISTRATION
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="register"&&(
        <div style={{...S.page,...anim}}>
          <div style={{maxWidth:700,margin:"0 auto"}}>
            {!regSuccess?<>
              <div style={{textAlign:"center",marginBottom:32}}>
                <span style={{fontSize:44}}>👨‍🍳</span>
                <h2 style={S.formTitle}>Register Your Catering Business</h2>
                <p style={S.formSub}>Join Newtown's fastest-growing caterer network · Receive WhatsApp quote requests</p>
              </div>
              <div style={S.formGrid}>
                {/* Basic fields */}
                {[["Business Name *","name","e.g. Kolkata Grand Feast","text"],["Owner / Manager Name *","ownerName","Full name","text"]].map(([lbl,key,ph,type])=>(
                  <div key={key} style={S.fieldWrap}><label style={S.fieldLabel}>{lbl}</label>
                    <input style={{...S.fieldInput,borderColor:regErrors[key]?"#ef4444":"#1e293b"}} type={type} value={regForm[key]} onChange={e=>setRegForm({...regForm,[key]:e.target.value})} placeholder={ph}/>
                    {regErrors[key]&&<div style={S.fieldErr}>{regErrors[key]}</div>}
                  </div>
                ))}
                <div style={S.fieldWrap}><label style={S.fieldLabel}>WhatsApp Number *</label>
                  <div style={{display:"flex",border:`1px solid ${regErrors.phone?"#ef4444":"#1e293b"}`,borderRadius:10,overflow:"hidden"}}>
                    <div style={{padding:"12px",background:"#1e293b",color:"#94a3b8",fontSize:13,whiteSpace:"nowrap"}}>+91</div>
                    <input style={{...S.fieldInput,border:"none",borderRadius:0,flex:1}} type="tel" maxLength={10} value={regForm.phone} onChange={e=>setRegForm({...regForm,phone:e.target.value.replace(/\D/g,"")})} placeholder="10-digit WhatsApp number"/>
                  </div>
                  {regErrors.phone&&<div style={S.fieldErr}>{regErrors.phone}</div>}
                  <div style={S.fieldHint}>📲 Hidden from customers. Quote requests via WhatsApp.</div>
                </div>
                <div style={S.fieldWrap}><label style={S.fieldLabel}>Email *</label>
                  <input style={{...S.fieldInput,borderColor:regErrors.email?"#ef4444":"#1e293b"}} type="email" value={regForm.email} onChange={e=>setRegForm({...regForm,email:e.target.value})} placeholder="business@email.com"/>
                  {regErrors.email&&<div style={S.fieldErr}>{regErrors.email}</div>}
                </div>
                <div style={{...S.fieldWrap,gridColumn:"1 / -1"}}><label style={S.fieldLabel}>Full Address *</label>
                  <input style={{...S.fieldInput,borderColor:regErrors.address?"#ef4444":"#1e293b"}} value={regForm.address} onChange={e=>setRegForm({...regForm,address:e.target.value})} placeholder="Plot/Flat No., Block/Area, Street Name"/>
                  {regErrors.address&&<div style={S.fieldErr}>{regErrors.address}</div>}
                </div>
                <div style={S.fieldWrap}><label style={S.fieldLabel}>Pincode *</label>
                  <input style={{...S.fieldInput,borderColor:regErrors.pincode?"#ef4444":"#1e293b"}} maxLength={6} value={regForm.pincode} onChange={e=>setRegForm({...regForm,pincode:e.target.value.replace(/\D/g,"")})} placeholder="e.g. 700156"/>
                  {regErrors.pincode&&<div style={S.fieldErr}>{regErrors.pincode}</div>}
                  <div style={S.fieldHint}>Supported: 700156, 700157, 700135, 700161, 700136, 700059, 700091, 700105, 700107, 700160</div>
                </div>
                <div style={S.fieldWrap}><label style={S.fieldLabel}>Price Range</label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {["₹","₹₹","₹₹₹","₹₹₹₹"].map(p=><button key={p} onClick={()=>setRegForm({...regForm,priceRange:p})} style={{...S.selChip,background:regForm.priceRange===p?"#f97316":"#1e293b",color:regForm.priceRange===p?"#fff":"#94a3b8"}}>{p}</button>)}
                  </div>
                </div>
                {/* Service Types */}
                <div style={{...S.fieldWrap,gridColumn:"1 / -1"}}><label style={S.fieldLabel}>Service Types Offered *</label>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    {Object.values(SVC).map(svc=>(
                      <button key={svc.id} onClick={()=>toggleRegSvc(svc.id)}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"14px",border:`2px solid ${regForm.serviceTypes.includes(svc.id)?svc.color:"#1e293b"}`,borderRadius:12,cursor:"pointer",background:regForm.serviceTypes.includes(svc.id)?svc.grad:"rgba(255,255,255,0.02)"}}>
                        <span style={{fontSize:22}}>{svc.icon}</span>
                        <div style={{textAlign:"left",flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:regForm.serviceTypes.includes(svc.id)?svc.color:"#94a3b8"}}>{svc.label}</div>
                          <div style={{fontSize:11,color:"#475569"}}>{svc.tagline}</div>
                        </div>
                        {regForm.serviceTypes.includes(svc.id)&&<span style={{color:svc.color,fontSize:16,marginLeft:"auto"}}>✓</span>}
                      </button>
                    ))}
                  </div>
                  {regErrors.serviceTypes&&<div style={S.fieldErr}>{regErrors.serviceTypes}</div>}
                </div>
                {/* Cuisines */}
                <div style={{...S.fieldWrap,gridColumn:"1 / -1"}}><label style={S.fieldLabel}>Cuisine Specialties *</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {ALL_CUISINES.map(c=><button key={c} onClick={()=>toggleRegCuisine(c)}
                      style={{...S.selChip,background:regForm.cuisineSpecialties.includes(c)?"rgba(249,115,22,0.15)":"#0f172a",color:regForm.cuisineSpecialties.includes(c)?"#f97316":"#64748b",border:`1px solid ${regForm.cuisineSpecialties.includes(c)?"#f97316":"#1e293b"}`}}>
                      {regForm.cuisineSpecialties.includes(c)&&"✓ "}{c}</button>)}
                  </div>
                  {regErrors.cuisineSpecialties&&<div style={S.fieldErr}>{regErrors.cuisineSpecialties}</div>}
                </div>
                {/* Event Specialties */}
                <div style={{...S.fieldWrap,gridColumn:"1 / -1"}}><label style={S.fieldLabel}>Event Specialties *</label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {["Wedding","Party","Corporate","Religious"].map(sp=><button key={sp} onClick={()=>setRegForm(prev=>({...prev,specialty:prev.specialty.includes(sp)?prev.specialty.filter(s=>s!==sp):[...prev.specialty,sp]}))} style={{...S.selChip,background:regForm.specialty.includes(sp)?"#f97316":"#1e293b",color:regForm.specialty.includes(sp)?"#fff":"#94a3b8"}}>{sp}</button>)}
                  </div>
                  {regErrors.specialty&&<div style={S.fieldErr}>{regErrors.specialty}</div>}
                </div>
                <div style={S.fieldWrap}><label style={S.fieldLabel}>Quote Turnaround</label>
                  <div style={{display:"flex",gap:8}}>
                    {["1–2 hrs","2–3 hrs","3–4 hrs","4–6 hrs"].map(t=><button key={t} onClick={()=>setRegForm({...regForm,turnaround:t})} style={{...S.selChip,background:regForm.turnaround===t?"#f97316":"#1e293b",color:regForm.turnaround===t?"#fff":"#94a3b8"}}>{t}</button>)}
                  </div>
                </div>
              </div>
              <div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:10,padding:"14px 18px",fontSize:13,color:"#94a3b8",lineHeight:1.6,marginTop:24}}>
                🔒 Your phone number is never shown to customers. Quote requests are sent via Aayojan's WhatsApp channel.
              </div>
              <div style={{display:"flex",gap:12,marginTop:20}}>
                <button onClick={()=>navigate("landing")} style={S.secondaryBtn}>← Back</button>
                <button onClick={submitRegistration} style={{...S.primaryBtn,flex:1,marginTop:0}}>Register Business 🚀</button>
              </div>
            </>:(
              <div style={{textAlign:"center",padding:"20px 0"}}>
                <div style={{fontSize:60}}>🎉</div>
                <h2 style={S.formTitle}>You're Registered!</h2>
                <p style={S.formSub}>Welcome to Aayojan, <strong style={{color:"#f97316"}}>{regForm.name}</strong></p>
                <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:"20px",margin:"24px 0",textAlign:"left"}}>
                  {[["📍 Area",PINCODE_COORDS[regForm.pincode]?.area||regForm.pincode],["🛎️ Services",regForm.serviceTypes.map(t=>SVC[t].label).join(", ")],["🍽️ Cuisines",regForm.cuisineSpecialties.join(", ")],["📲 WhatsApp",`+91 ${maskPhone(regForm.phone)} (hidden)`]].map(([lbl,val])=>(
                    <div key={lbl} style={{display:"flex",justifyContent:"space-between",fontSize:14,marginBottom:10,color:"#94a3b8"}}><span>{lbl}</span><span style={{textAlign:"right",maxWidth:"60%"}}>{val}</span></div>
                  ))}
                </div>
                <div style={{display:"flex",gap:12}}>
                  <button onClick={()=>{setRegSuccess(false);setRegForm({name:"",ownerName:"",phone:"",email:"",address:"",pincode:"",specialty:[],cuisineSpecialties:[],serviceTypes:[],priceRange:"₹₹",turnaround:"2–3 hrs"});}} style={S.secondaryBtn}>Register Another</button>
                  <button onClick={()=>navigate("landing")} style={{...S.primaryBtn,marginTop:0,flex:1}}>Go to Home →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DB VIEWER
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="dbview"&&(
        <div style={{...S.page,...anim}}>
          <div style={{maxWidth:820,margin:"0 auto"}}>
            <h2 style={S.formTitle}>🗄️ Database Viewer</h2>
            <p style={{...S.formSub,marginBottom:20}}>Live in-memory records</p>
            <div style={{display:"flex",gap:0,borderBottom:"1px solid #1e293b",marginBottom:24,flexWrap:"wrap"}}>
              {[["caterers",`🍽️ Caterers (${dbData.caterers.length})`],["customers",`👥 Customers (${dbData.customers.length})`],["quotationRequests",`📲 Quotations (${dbData.quotationRequests?.length||0})`],["orders",`📦 Orders (${dbData.orders.length})`],["chatOrders",`🤖 Chat Orders (${dbData.chatOrders?.length||0})`]].map(([t,lbl])=>(
                <button key={t} onClick={()=>setDbTab(t)} style={{padding:"10px 16px",background:"none",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",borderBottom:dbTab===t?"2px solid #f97316":"2px solid transparent",color:dbTab===t?"#f97316":"#64748b"}}>{lbl}</button>
              ))}
            </div>
            {dbTab==="caterers"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {dbData.caterers.map(c=>(
                <div key={c.id} style={{background:"rgba(255,255,255,0.02)",border:"1px solid #1e293b",borderRadius:10,padding:"12px 16px"}}>
                  <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:6}}>
                    <span style={{fontSize:20}}>{c.logo}</span><span style={{fontWeight:700,color:"#fff"}}>{c.name}</span>
                    <span style={{fontSize:13,color:"#94a3b8"}}>📍 {c.pincode}</span><span style={{fontSize:13,color:"#94a3b8"}}>📞 {maskPhone(c.phone)}</span><span style={{fontSize:13,color:"#94a3b8"}}>⭐ {c.rating}</span>
                    <span style={{fontSize:13,color:c.active?"#4ade80":"#ef4444"}}>{c.active?"● Active":"○ Inactive"}</span>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {(c.serviceTypes||["full"]).map(st=><span key={st} style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:`rgba(${SVC[st]?.accentRGB},0.1)`,color:SVC[st]?.color,border:`1px solid rgba(${SVC[st]?.accentRGB},0.25)`}}>{SVC[st]?.icon} {SVC[st]?.label}</span>)}
                    {c.cuisineSpecialties?.map(cs=><span key={cs} style={{fontSize:11,color:"#94a3b8"}}>{cs}</span>)}
                  </div>
                </div>
              ))}
            </div>}
            {dbTab==="customers"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {dbData.customers.length===0?<div style={{color:"#475569",padding:"20px",textAlign:"center"}}>No customers yet.</div>:dbData.customers.map(c=>(
                <div key={c.id} style={{background:"rgba(255,255,255,0.02)",border:"1px solid #1e293b",borderRadius:10,padding:"12px 16px",display:"flex",gap:14}}>
                  <span>👤</span><span style={{fontWeight:700,color:"#fff"}}>{c.phone}</span><span style={{fontSize:13,color:"#64748b"}}>{c.registeredAt?.split("T")[0]}</span>
                </div>
              ))}
            </div>}
            {dbTab==="quotationRequests"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {(dbData.quotationRequests||[]).length===0?<div style={{color:"#475569",padding:"20px",textAlign:"center"}}>No quotation requests yet.</div>:(dbData.quotationRequests||[]).map(qr=>(
                <div key={qr.id} style={{background:"rgba(255,255,255,0.02)",border:"1px solid #1e293b",borderRadius:10,padding:"12px 16px"}}>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:6}}>
                    <span style={{fontWeight:800,color:"#f97316",fontSize:13}}>{qr.id}</span>
                    <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:`rgba(${SVC[qr.serviceType]?.accentRGB},0.1)`,color:SVC[qr.serviceType]?.color}}>{SVC[qr.serviceType]?.icon} {qr.serviceType==="full"?"Full Service":"Bulk Delivery"}</span>
                    <span style={{fontSize:13,color:"#94a3b8"}}>🎉 {qr.eventType}</span><span style={{fontSize:13,color:"#94a3b8"}}>👥 {qr.guestCount}</span><span style={{fontSize:13,color:"#4ade80"}}>₹{qr.perPlateBudget}/plate</span>
                  </div>
                  <div style={{fontSize:11,color:"#475569"}}>⏰ Expires: {new Date(qr.expiresAt).toLocaleString("en-IN")}</div>
                  {qr.whatsappLog?.map(w=><div key={w.catererId} style={{fontSize:12,color:"#94a3b8",paddingLeft:12}}>{w.catererName} · {w.maskedPhone} · <span style={{color:"#4ade80"}}>{w.status}</span></div>)}
                </div>
              ))}
            </div>}
            {dbTab==="orders"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {dbData.orders.length===0?<div style={{color:"#475569",padding:"20px",textAlign:"center"}}>No orders yet.</div>:dbData.orders.map(o=>(
                <div key={o.id} style={{background:"rgba(255,255,255,0.02)",border:"1px solid #1e293b",borderRadius:10,padding:"12px 16px"}}>
                  <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:4}}>
                    <span style={{fontWeight:800,color:"#f97316"}}>{o.id}</span><span style={{fontSize:13,color:"#94a3b8"}}>{o.catererName}</span>
                    <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:`rgba(${SVC[o.serviceType]?.accentRGB},0.1)`,color:SVC[o.serviceType]?.color}}>{SVC[o.serviceType]?.icon}</span>
                    <span style={{fontSize:13,color:"#94a3b8"}}>👥{o.guestCount}</span><span style={{fontSize:13,color:"#94a3b8"}}>₹{o.perPlateActual}/plate</span><span style={{fontSize:13,color:"#4ade80"}}>₹{o.totalPrice?.toLocaleString()}</span>
                  </div>
                  <div style={{fontSize:12,color:"#475569"}}>📍 {o.deliveryAddress}</div>
                </div>
              ))}
            </div>}
            {dbTab==="chatOrders"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {(dbData.chatOrders||[]).length===0?<div style={{color:"#475569",padding:"20px",textAlign:"center"}}>No chat orders yet. Try the AI chatbot!</div>:(dbData.chatOrders||[]).map(o=>(
                <div key={o.id} style={{background:"rgba(99,102,241,0.04)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:10,padding:"12px 16px"}}>
                  <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:6}}>
                    <span style={{fontWeight:800,color:"#818cf8"}}>{o.id}</span><span style={{fontSize:12,padding:"2px 8px",borderRadius:4,background:"rgba(99,102,241,0.1)",color:"#818cf8",border:"1px solid rgba(99,102,241,0.25)"}}>🤖 Chatbot</span>
                    <span style={{fontSize:13,color:"#94a3b8",textTransform:"capitalize"}}>{o.eventType}</span><span style={{fontSize:13,color:"#94a3b8"}}>👥{o.guestCount}</span>
                    <span style={{fontSize:13,color:"#4ade80"}}>₹{o.perPlateBudget}/plate</span><span style={{fontSize:13,color:"#4ade80"}}>{o.status}</span>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{o.menuItems?.map(m=><span key={m} style={{fontSize:11,color:"#64748b"}}>{m}</span>)}</div>
                </div>
              ))}
            </div>}
            <button onClick={()=>navigate("landing")} style={{...S.secondaryBtn,marginTop:24}}>← Back to Home</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          APP FLOW (Steps 0–6)
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="app"&&(
        <div style={{...S.page,...anim}}>
          {step<6&&<>
            {stCfg&&<div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,background:stCfg.grad,border:`1px solid ${stCfg.border}`,borderRadius:20,padding:"5px 16px"}}>
                <span>{stCfg.icon}</span><span style={{fontSize:13,fontWeight:700,color:stCfg.color}}>{stCfg.label}</span>
                <button onClick={resetApp} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:11}}>Change ×</button>
              </div>
            </div>}
            <div style={S.progressWrap}>
              {STEPS.map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center"}}>
                  <div style={{...S.progDot,background:i<=step?accent:"#334155",boxShadow:i===step?`0 0 0 4px ${accent}44`:"none",transform:i===step?"scale(1.15)":"scale(1)"}}>{i<step?"✓":i+1}</div>
                  {i<STEPS.length-1&&<div style={{...S.progLine,background:i<step?accent:"#334155"}}/>}
                </div>
              ))}
            </div>
            <div style={S.stepLabels}>{STEPS.map((s,i)=><span key={i} style={{...S.stepLbl,color:i===step?accent:"#475569"}}>{s}</span>)}</div>
          </>}

          <div style={S.card}>
            {/* STEP 0: Service Selection */}
            {step===0&&<div>
              <h2 style={S.cardTitle}>Choose Your Service</h2>
              <p style={S.cardSub}>How would you like your catering?</p>
              <div style={S.svcGrid}>
                {Object.values(SVC).map(svc=>(
                  <button key={svc.id} onClick={()=>{setServiceType(svc.id);setStep(1);}} style={{...S.svcCard,background:svc.grad,borderColor:svc.border}}>
                    <div style={{...S.svcCardIcon,background:`rgba(${svc.accentRGB},0.15)`}}>{svc.icon}</div>
                    <div style={{...S.svcCardLabel,color:svc.color}}>{svc.label}</div>
                    <div style={S.svcCardTagline}>{svc.tagline}</div>
                    <div style={S.svcFeatures}>{svc.features.map(f=><div key={f} style={{...S.svcFeatureItem,color:svc.id==="full"?"#fdba74":"#a5b4fc"}}>✓ {f}</div>)}</div>
                  </button>
                ))}
              </div>
            </div>}

            {/* STEP 1: Pincode */}
            {step===1&&<div>
              <h2 style={S.cardTitle}>Enter Your Pincode</h2>
              <p style={S.cardSub}>We'll show <span style={{color:accent}}>{stCfg?.label}</span> caterers within <strong style={{color:"#4ade80"}}>5 km</strong>. Extra km: ₹20 surcharge.</p>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:10}}>
                <span style={{fontSize:32}}>📍</span>
                <input style={{flex:1,background:"#0f172a",border:`2px solid ${pincodeError?"#ef4444":customerPincode?accent:"#1e293b"}`,borderRadius:14,padding:"18px 22px",color:"#fff",fontSize:28,fontWeight:800,outline:"none",letterSpacing:"0.15em",textAlign:"center",transition:"border-color 0.2s"}}
                  type="tel" maxLength={6} value={customerPincode}
                  onChange={e=>{setCustomerPincode(e.target.value.replace(/\D/g,""));setPincodeError("");}}
                  onKeyDown={e=>e.key==="Enter"&&handlePincodeNext()} placeholder="700156" autoFocus/>
              </div>
              {pincodeError&&<div style={{...S.errMsg,textAlign:"center"}}>{pincodeError}</div>}
              <div style={{marginTop:16,marginBottom:14}}>
                <div style={{fontSize:11,color:"#475569",marginBottom:8,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em"}}>Supported pincodes:</div>
                <div style={S.chipRow}>
                  {Object.entries(PINCODE_COORDS).map(([pin])=><button key={pin} onClick={()=>{setCustomerPincode(pin);setPincodeError("");}} style={{...S.chip,background:customerPincode===pin?accent:"#1e293b",color:customerPincode===pin?"#fff":"#64748b",borderColor:customerPincode===pin?accent:"#334155"}}>{pin}</button>)}
                </div>
              </div>
              {customerPincode&&PINCODE_COORDS[customerPincode]&&<div style={{background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:8,padding:"10px 16px",fontSize:14,color:"#4ade80",marginBottom:14}}>✅ <strong>{PINCODE_COORDS[customerPincode].area}</strong></div>}
              <button onClick={handlePincodeNext} disabled={customerPincode.length!==6} style={{...S.primaryBtn,background:accentGrad,opacity:customerPincode.length===6?1:0.4}}>Find Caterers Near Me →</button>
            </div>}

            {/* STEP 2: Event */}
            {step===2&&<div>
              <h2 style={S.cardTitle}>What's the occasion?</h2>
              <p style={S.cardSub}>Near {customerCoords?.area} · {stCfg?.label}</p>
              <div style={S.eventGrid}>
                {EVENT_TYPES.map(e=><button key={e.id} onClick={()=>setEventType(e.id)} style={{...S.eventCard,borderColor:eventType===e.id?accent:"#1e293b",background:eventType===e.id?`${accent}14`:"rgba(255,255,255,0.02)",transform:eventType===e.id?"translateY(-3px)":"none"}}>
                  <span style={{fontSize:34}}>{e.icon}</span><span style={{fontSize:16,fontWeight:700,color:"#fff"}}>{e.label}</span><span style={{fontSize:12,color:"#64748b",textAlign:"center"}}>{e.desc}</span>
                </button>)}
              </div>
              <div style={S.btnRow}>
                <button onClick={()=>setStep(1)} style={S.secondaryBtn}>← Back</button>
                <button onClick={()=>setStep(3)} disabled={!eventType} style={{...S.primaryBtn,marginTop:0,flex:1,background:accentGrad,opacity:eventType?1:0.4}}>Continue →</button>
              </div>
            </div>}

            {/* STEP 3: Guests + Per-plate Budget */}
            {step===3&&<div>
              <h2 style={S.cardTitle}>Guests & Budget</h2>
              <p style={S.cardSub}>Set headcount and your per-{serviceType==="full"?"plate":"portion"} budget</p>
              {/* Guest count */}
              <div style={{marginBottom:28}}>
                <div style={{fontSize:13,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>👥 Number of Guests</div>
                {serviceType==="full"&&guestCount<30&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"8px 14px",fontSize:13,color:"#fca5a5",marginBottom:10}}>⚠️ Full Catering requires minimum 30 guests</div>}
                <div style={{textAlign:"center",marginBottom:16}}>
                  <span style={{fontSize:64,fontWeight:900,color:accent,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{guestCount}</span>
                  <div style={{fontSize:14,color:"#64748b",marginTop:4}}>Guests{serviceType==="full"?" (min. 30)":""}</div>
                </div>
                <input type="range" min={serviceType==="full"?30:1} max={1000} step={serviceType==="full"?10:1} value={guestCount} onChange={e=>setGuestCount(Number(e.target.value))} style={{width:"100%",marginBottom:8,accentColor:accent}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#475569",marginBottom:16}}><span>{serviceType==="full"?"30":"1"}</span><span>1000+</span></div>
                <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                  {(serviceType==="full"?[50,100,200,300,500]:[10,25,50,100,200]).map(n=><button key={n} onClick={()=>setGuestCount(n)} style={{padding:"7px 16px",borderRadius:8,border:"1px solid #334155",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",background:guestCount===n?accent:"#1e293b"}}>{n}</button>)}
                </div>
              </div>
              {/* Per-plate budget */}
              <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:24}}>
                <div style={{fontSize:13,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:14}}>💰 Per-{serviceType==="full"?"Plate":"Portion"} Budget</div>
                <BudgetSlider svcType={serviceType} value={perPlateBudget} onChange={setPerPlateBudget}/>
              </div>
              <div style={S.btnRow}>
                <button onClick={()=>setStep(2)} style={S.secondaryBtn}>← Back</button>
                <button onClick={()=>setStep(4)} disabled={serviceType==="full"&&guestCount<30} style={{...S.primaryBtn,marginTop:0,flex:1,background:accentGrad,opacity:(serviceType==="full"&&guestCount<30)?0.4:1}}>Continue to Menu →</button>
              </div>
            </div>}

            {/* STEP 4: Menu */}
            {step===4&&<div>
              <h2 style={S.cardTitle}>Build Your Menu</h2>
              <p style={S.cardSub}>{selectedItems.length} items selected · Budget: <span style={{color:accent}}>₹{perPlateBudget}/{serviceType==="full"?"plate":"portion"}</span></p>
              {Object.entries(MENU_ITEMS).map(([cat,items])=>(
                <div key={cat} style={{marginBottom:20}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:accent,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${accent}33`}}>{cat}</div>
                  <div style={S.chipRow}>
                    {items.map(item=><button key={item} onClick={()=>toggleItem(item)} style={{...S.chip,background:selectedItems.includes(item)?accent:"#1e293b",color:selectedItems.includes(item)?"#fff":"#94a3b8",borderColor:selectedItems.includes(item)?accent:"#334155"}}>{selectedItems.includes(item)&&"✓ "}{item}</button>)}
                  </div>
                </div>
              ))}
              <div style={{display:"flex",gap:10,marginTop:16,marginBottom:14}}>
                <input value={customItem} onChange={e=>setCustomItem(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCustomItem()} placeholder="Add custom dish..." style={{flex:1,padding:"11px 16px",background:"#0f172a",border:"1px solid #334155",borderRadius:10,color:"#fff",fontSize:14,outline:"none"}}/>
                <button onClick={addCustomItem} style={{padding:"11px 18px",background:"#1e293b",border:"1px solid #334155",borderRadius:10,color:accent,fontWeight:700,fontSize:14,cursor:"pointer"}}>+ Add</button>
              </div>
              {selectedItems.length>0&&<div style={{background:`${accent}0d`,border:`1px solid ${accent}33`,borderRadius:12,padding:"14px",marginTop:12}}>
                <div style={{fontSize:12,fontWeight:700,color:accent,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Selected ({selectedItems.length})</div>
                <div style={S.chipRow}>{selectedItems.map(item=><span key={item} onClick={()=>toggleItem(item)} style={{...S.chip,background:"#0f172a",cursor:"pointer",borderColor:accent,color:accent}}>{item} ×</span>)}</div>
              </div>}
              <div style={{display:"flex",gap:14,alignItems:"flex-start",background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:12,padding:"16px",marginTop:16}}>
                <span style={{fontSize:26}}>⏳</span>
                <div><div style={{fontWeight:700,color:"#fff",marginBottom:3}}>Quotation in 48 Hours</div><div style={{fontSize:13,color:"#94a3b8",lineHeight:1.5}}>WhatsApp sent to <strong style={{color:accent}}>up to 5 caterers</strong> near you with your budget of <strong style={{color:accent}}>₹{perPlateBudget}/{serviceType==="full"?"plate":"portion"}</strong>.</div></div>
              </div>
              {authStage!=="verified"&&selectedItems.length>0&&<div style={{background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:10,padding:"11px 16px",fontSize:13,color:"#94a3b8",marginTop:12}}>🔒 Login required to send quote requests.</div>}
              <div style={S.btnRow}>
                <button onClick={()=>setStep(3)} style={S.secondaryBtn}>← Back</button>
                <button onClick={generateQuotes} disabled={selectedItems.length===0} style={{...S.primaryBtn,marginTop:0,flex:1,background:accentGrad,opacity:selectedItems.length>0?1:0.4}}>
                  {loading?"Sending...":authStage==="verified"?"Send Quotation Request 📲":"Login & Send Request 🔒"}
                </button>
              </div>
              {loading&&<div style={{marginTop:16,height:3,background:"#1e293b",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",background:accentGrad,animation:"loadSlide 1.6s ease forwards"}}/></div>}
            </div>}

            {/* STEP 5: Quotes */}
            {step===5&&<div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div><h2 style={S.cardTitle}>Quotation Sent! ✅</h2><p style={S.cardSub}>{quotes.length} caterers contacted · {stCfg?.label}</p></div>
                {user&&<div style={{background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:8,padding:"6px 12px",fontSize:12,color:"#4ade80"}}>✅ {user.phone}</div>}
              </div>
              {quotationRequest&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:`rgba(${stCfg.accentRGB},0.07)`,border:`1px solid rgba(${stCfg.accentRGB},0.22)`,borderRadius:14,padding:"16px 20px",marginBottom:18,gap:14}}>
                <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                  <span style={{fontSize:28}}>⏰</span>
                  <div><div style={{fontWeight:800,color:"#fff",fontSize:15}}>Awaiting Responses</div><div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>Request: <span style={{color:accent,fontFamily:"monospace"}}>{quotationRequest.id}</span></div><div style={{fontSize:11,color:"#64748b",marginTop:2}}>Expires: {new Date(quotationRequest.expiresAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</div></div>
                </div>
                <div style={{textAlign:"center",flexShrink:0}}><div style={{fontSize:42,fontWeight:900,color:accent,fontFamily:"'Playfair Display',serif",lineHeight:1}}>48</div><div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.07em"}}>Hours</div></div>
              </div>}
              {/* WhatsApp log */}
              <div style={{background:"#0a1628",border:"1px solid rgba(37,211,102,0.2)",borderRadius:14,padding:"14px 18px",marginBottom:18}}>
                <div style={{fontSize:11,fontWeight:700,color:"#25d366",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>📲 WhatsApp Dispatch Log</div>
                {whatsappSent.map((w,i)=>{
                  const cat=quotes.find(q=>q.id===w.catererId);
                  const waUrl=cat?`https://wa.me/91${cat.phone}?text=${buildWAMsg(cat,quotationRequest)}`:"#";
                  return(
                    <div key={w.catererId} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                      <div style={{width:24,height:24,borderRadius:"50%",background:"rgba(37,211,102,0.15)",color:"#25d366",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                      <div style={{flex:1}}><div style={{fontWeight:700,color:"#fff",fontSize:13}}>{w.catererName}</div><div style={{fontSize:11,color:"#64748b"}}>📞 {w.maskedPhone} · {new Date(w.sentAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div></div>
                      <span style={{fontSize:11,color:"#25d366",background:"rgba(37,211,102,0.1)",border:"1px solid rgba(37,211,102,0.25)",borderRadius:5,padding:"2px 8px",whiteSpace:"nowrap"}}>{w.status}</span>
                      <a href={waUrl} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#fff",background:"#25d366",borderRadius:5,padding:"4px 10px",fontWeight:700,whiteSpace:"nowrap"}}>Open WA ↗</a>
                    </div>
                  );
                })}
              </div>
              {/* Summary */}
              <div style={{display:"flex",justifyContent:"space-around",background:`rgba(${stCfg.accentRGB},0.07)`,border:`1px solid rgba(${stCfg.accentRGB},0.18)`,borderRadius:12,padding:"12px",marginBottom:14}}>
                {[["📍",customerPincode,"Pincode"],["👥",guestCount,"Guests"],[`💰`,`₹${perPlateBudget}`,serviceType==="full"?"Per Plate":"Per Portion"],["🍽️",selectedItems.length,"Dishes"]].map(([icon,val,lbl])=>(
                  <div key={lbl} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span>{icon}</span><span style={{fontSize:15,fontWeight:800,color:accent}}>{val}</span><span style={{fontSize:9,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.07em"}}>{lbl}</span>
                  </div>
                ))}
              </div>
              <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid #1e293b",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#64748b",marginBottom:16}}>
                Sorted by per-plate price. <span style={{color:"#4ade80"}}>🟢 Within budget</span> · <span style={{color:"#f87171"}}>🔴 Over budget</span> · Beyond 5 km: <strong style={{color:accent}}>+₹{KM_RATE}/km</strong> surcharge.
              </div>
              {quotes.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"#475569"}}>😔 No caterers found for <strong>{eventType}</strong> near {customerPincode}.</div>}
              {quotes.map(q=>(
                <div key={q.id} style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${selectedQuote?.id===q.id?"#4ade80":expandedCaterer===q.id?accent:"#1e293b"}`,borderRadius:16,padding:"18px 20px",marginBottom:14,transition:"border-color 0.2s"}}>
                  <div style={{display:"flex",gap:7,marginBottom:10,flexWrap:"wrap"}}>
                    <span style={{fontSize:12,padding:"3px 12px",borderRadius:20,fontWeight:700,background:q.withinBudget?"rgba(74,222,128,0.1)":"rgba(239,68,68,0.1)",color:q.withinBudget?"#4ade80":"#f87171",border:`1px solid ${q.withinBudget?"rgba(74,222,128,0.3)":"rgba(239,68,68,0.3)"}`}}>
                      {q.withinBudget?`✓ Within budget · ₹${q.perPlateActual}/plate`:`⚠ Over budget · ₹${q.perPlateActual}/plate`}
                    </span>
                    <span style={{fontSize:12,padding:"3px 12px",borderRadius:20,border:"1px solid",fontWeight:600,background:q.distanceKm<=5?"rgba(74,222,128,0.1)":"rgba(249,115,22,0.1)",borderColor:q.distanceKm<=5?"rgba(74,222,128,0.3)":"rgba(249,115,22,0.3)",color:q.distanceKm<=5?"#4ade80":"#f97316"}}>
                      📍 {q.distanceKm} km {q.distanceKm<=5?"✓ Free zone":`+₹${q.travelSurcharge}`}
                    </span>
                  </div>
                  <div style={{display:"flex",gap:12,marginBottom:10}}>
                    <div style={{width:48,height:48,fontSize:22,background:"#0f172a",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{q.logo}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:16,fontWeight:700,color:"#fff",marginBottom:2}}>{q.name}</div>
                      <div style={{fontSize:12,color:"#64748b",marginBottom:3}}>⭐{q.rating} · 📍{PINCODE_COORDS[q.pincode]?.area} · ⏱{q.turnaround}</div>
                      <div style={{fontSize:12,color:"#475569",marginBottom:5}}>📞 <span style={{fontFamily:"monospace"}}>{maskPhone(q.phone)}</span> <span style={{fontSize:10,color:"#64748b",background:"rgba(100,116,139,0.1)",border:"1px solid rgba(100,116,139,0.2)",borderRadius:4,padding:"1px 6px",marginLeft:4}}>🔒 Hidden</span></div>
                      {q.cuisineSpecialties?.length>0&&<div style={{...S.chipRow,marginBottom:5}}>{q.cuisineSpecialties.map(cs=><span key={cs} style={{...S.chip2,color:accent,borderColor:`${accent}44`,background:`${accent}11`,fontSize:10}}>🍽️ {cs}</span>)}</div>}
                      <div style={S.chipRow}>{q.tags.map(t=><span key={t} style={S.chip2}>{t}</span>)}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:10,color:"#64748b"}}>Per {serviceType==="full"?"plate":"portion"}</div>
                      <div style={{fontSize:20,fontWeight:900,color:q.withinBudget?"#4ade80":"#f87171"}}>₹{q.perPlateActual}</div>
                      <div style={{fontSize:10,color:"#475569",marginTop:5}}>Total</div>
                      <div style={{fontSize:16,fontWeight:900,color:"#4ade80"}}>₹{q.totalPrice.toLocaleString()}</div>
                      {q.travelSurcharge>0&&<div style={{fontSize:10,color:"#f97316"}}>+₹{q.travelSurcharge} travel</div>}
                    </div>
                  </div>
                  <div style={{background:"#0f172a",borderRadius:9,padding:"10px 14px",marginBottom:10}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Quote Code</div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{fontSize:15,fontWeight:800,fontFamily:"monospace",color:accent,letterSpacing:"0.08em"}}>{q.quoteCode}</span>
                      <button onClick={()=>copyCode(q.quoteCode)} style={{padding:"5px 12px",borderRadius:7,background:"#1e293b",border:"1px solid #334155",color:"#94a3b8",fontSize:11,cursor:"pointer"}}>{copiedCode===q.quoteCode?"✅ Copied!":"📋 Copy"}</button>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                    <button onClick={()=>setExpandedCaterer(expandedCaterer===q.id?null:q.id)} style={{background:"none",border:"none",color:"#64748b",fontSize:12,cursor:"pointer",padding:"3px 0"}}>{expandedCaterer===q.id?"▲ Hide":"▼ Details"}</button>
                    <button onClick={()=>{setSelectedQuote(q);setStep(6);}} style={{...S.primaryBtn,marginTop:0,flex:1,padding:"9px 18px",fontSize:13,background:accentGrad}}>Select & Place Order →</button>
                  </div>
                  {expandedCaterer===q.id&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Menu ({q.itemsCovered} dishes)</div>
                    <div style={S.chipRow}>{selectedItems.slice(0,10).map(item=><span key={item} style={{...S.chip,background:"#0f172a",color:"#94a3b8",borderColor:"#1e293b",cursor:"default",fontSize:11}}>✓ {item}</span>)}{selectedItems.length>10&&<span style={{...S.chip,background:"#1e293b",color:"#64748b",borderColor:"#1e293b"}}>+{selectedItems.length-10} more</span>}</div>
                    <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,marginTop:12}}>{serviceType==="full"?"Full Service Inclusions":"Bulk Delivery Inclusions"}</div>
                    <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:4,color:"#64748b",fontSize:12}}>
                      {(serviceType==="full"?["✓ Serving staff on-site","✓ Cutlery, crockery & serveware","✓ Food counter setup & decoration","✓ Post-event cleanup"]:["✓ Food packed in containers","✓ Home/venue delivery","✓ No staff or setup","✓ Disposable cutlery on request"]).map(i=><li key={i}>{i}</li>)}
                    </ul>
                  </div>}
                </div>
              ))}
              <div style={S.btnRow}>
                <button onClick={()=>setStep(4)} style={S.secondaryBtn}>← Modify Menu</button>
                <button onClick={resetApp} style={{...S.secondaryBtn,color:"#ef4444",borderColor:"#ef4444"}}>Start Over</button>
              </div>
            </div>}

            {/* STEP 6: Address + Confirm */}
            {step===6&&!orderPlaced&&selectedQuote&&<div>
              <h2 style={S.cardTitle}>{serviceType==="full"?"Event Venue Address":"Delivery Address"}</h2>
              <p style={S.cardSub}>{serviceType==="full"?"Where will the event be held?":"Where should the food be delivered?"}</p>
              {/* Selected caterer card */}
              <div style={{background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:12,padding:"14px 18px",marginBottom:22}}>
                <div style={{fontSize:11,color:"#4ade80",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Selected Caterer</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:"#fff"}}>{selectedQuote.logo} {selectedQuote.name}</div>
                    <div style={{fontSize:12,color:"#64748b"}}>📞 <span style={{fontFamily:"monospace"}}>{maskPhone(selectedQuote.phone)}</span> <span style={{fontSize:10,color:"#64748b",background:"rgba(100,116,139,0.1)",border:"1px solid rgba(100,116,139,0.2)",borderRadius:3,padding:"1px 5px",marginLeft:4}}>🔒 Hidden</span></div>
                    {selectedQuote.cuisineSpecialties?.length>0&&<div style={{fontSize:12,color:accent,marginTop:3}}>🍽️ {selectedQuote.cuisineSpecialties.join(" · ")}</div>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:13,color:"#64748b"}}>₹{selectedQuote.perPlateActual} × {guestCount}</div>
                    <div style={{fontSize:20,fontWeight:900,color:"#4ade80"}}>₹{selectedQuote.totalPrice.toLocaleString()}</div>
                    {selectedQuote.travelSurcharge>0&&<div style={{fontSize:11,color:"#f97316"}}>incl. ₹{selectedQuote.travelSurcharge} travel</div>}
                  </div>
                </div>
              </div>
              <div style={S.formGrid}>
                {[["Flat / House No. *","flat","e.g. Flat 4B / House 12"],["Building / Society / Block *","building","e.g. Suncity Apartments"]].map(([lbl,key,ph])=>(
                  <div key={key} style={S.fieldWrap}><label style={S.fieldLabel}>{lbl}</label>
                    <input style={{...S.fieldInput,borderColor:addressErrors[key]?"#ef4444":"#1e293b"}} value={deliveryAddress[key]} onChange={e=>setDeliveryAddress({...deliveryAddress,[key]:e.target.value})} placeholder={ph}/>
                    {addressErrors[key]&&<div style={S.fieldErr}>{addressErrors[key]}</div>}
                  </div>
                ))}
                <div style={{...S.fieldWrap,gridColumn:"1 / -1"}}><label style={S.fieldLabel}>Street / Area *</label>
                  <input style={{...S.fieldInput,borderColor:addressErrors.street?"#ef4444":"#1e293b"}} value={deliveryAddress.street} onChange={e=>setDeliveryAddress({...deliveryAddress,street:e.target.value})} placeholder="e.g. Action Area I, Newtown"/>
                  {addressErrors.street&&<div style={S.fieldErr}>{addressErrors.street}</div>}
                </div>
                <div style={S.fieldWrap}><label style={S.fieldLabel}>Landmark (optional)</label><input style={S.fieldInput} value={deliveryAddress.landmark} onChange={e=>setDeliveryAddress({...deliveryAddress,landmark:e.target.value})} placeholder="Near school, post office etc."/></div>
                <div style={S.fieldWrap}><label style={S.fieldLabel}>Pincode *</label>
                  <input style={{...S.fieldInput,borderColor:addressErrors.pincode?"#ef4444":"#1e293b"}} type="tel" maxLength={6} value={deliveryAddress.pincode} onChange={e=>setDeliveryAddress({...deliveryAddress,pincode:e.target.value.replace(/\D/g,"")})} placeholder="6-digit pincode"/>
                  {addressErrors.pincode&&<div style={S.fieldErr}>{addressErrors.pincode}</div>}
                </div>
                <div style={S.fieldWrap}><label style={S.fieldLabel}>City</label><input style={{...S.fieldInput,background:"#0a1628",color:"#64748b"}} value="Kolkata" readOnly/></div>
                <div style={S.fieldWrap}><label style={S.fieldLabel}>State</label><input style={{...S.fieldInput,background:"#0a1628",color:"#64748b"}} value="West Bengal" readOnly/></div>
              </div>
              {/* Order summary */}
              <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:"16px 20px",marginTop:18}}>
                <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Order Summary</div>
                {[["Service",stCfg?.label],["Event",eventType],["Guests",guestCount],["Per "+(serviceType==="full"?"plate":"portion"),`₹${selectedQuote.perPlateActual} (budget ₹${perPlateBudget})`],["Food Total",`₹${selectedQuote.basePrice.toLocaleString()}`],...(selectedQuote.travelSurcharge>0?[["Travel",`+₹${selectedQuote.travelSurcharge} (${selectedQuote.distanceKm} km)`]]:[])].map(([lbl,val])=>(
                  <div key={lbl} style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:14}}><span style={{color:"#64748b"}}>{lbl}</span><span style={{color:"#94a3b8",textTransform:lbl==="Event"?"capitalize":"none"}}>{val}</span></div>
                ))}
                <div style={{borderTop:"1px solid #1e293b",paddingTop:10,marginTop:4,display:"flex",justifyContent:"space-between",fontSize:18,fontWeight:800}}><span style={{color:"#fff"}}>Grand Total</span><span style={{color:"#4ade80"}}>₹{selectedQuote.totalPrice.toLocaleString()}</span></div>
              </div>
              <div style={S.btnRow}>
                <button onClick={()=>setStep(5)} style={S.secondaryBtn}>← Back</button>
                <button onClick={placeOrder} style={{...S.primaryBtn,marginTop:0,flex:1,background:"linear-gradient(135deg,#22c55e,#16a34a)"}}>Confirm Order ✅</button>
              </div>
            </div>}

            {/* Order confirmed */}
            {step===6&&orderPlaced&&<div style={{textAlign:"center"}}>
              <div style={{fontSize:72,marginBottom:16}}>🎉</div>
              <h2 style={{...S.cardTitle,textAlign:"center"}}>Order Confirmed!</h2>
              <div style={{background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.25)",borderRadius:16,padding:"22px",marginBottom:18}}>
                <div style={{fontSize:24,fontWeight:900,fontFamily:"monospace",color:"#4ade80",letterSpacing:"0.1em",marginBottom:14}}>{orderPlaced.id}</div>
                {[["Caterer",orderPlaced.catererName],["Service",SVC[orderPlaced.serviceType]?.label],["Event",orderPlaced.eventType],["Guests",orderPlaced.guestCount],["Per plate",`₹${orderPlaced.perPlateActual}`],["Grand Total",`₹${orderPlaced.totalPrice?.toLocaleString()}`],["Address",orderPlaced.deliveryAddress]].map(([lbl,val])=>(
                  <div key={lbl} style={{display:"flex",justifyContent:"space-between",marginBottom:9,fontSize:13,textAlign:"left",gap:12}}><span style={{color:"#64748b",flexShrink:0}}>{lbl}</span><span style={{color:"#e2e8f0",textAlign:"right",textTransform:lbl==="Event"?"capitalize":"none"}}>{val}</span></div>
                ))}
              </div>
              <p style={{color:"#94a3b8",fontSize:13,marginBottom:20,lineHeight:1.6}}>Aayojan will coordinate with the caterer and contact you at <strong style={{color:"#f97316"}}>{user?.phone}</strong>. Caterer's number remains private. 🔒</p>
              <div style={{display:"flex",gap:12}}>
                <button onClick={()=>{const d=DB.get();setDbData(d);navigate("dbview");setDbTab("orders");}} style={S.secondaryBtn}>View in DB 🗄️</button>
                <button onClick={()=>{navigate("landing");resetApp();}} style={{...S.primaryBtn,marginTop:0,flex:1}}>Back to Home</button>
              </div>
            </div>}
          </div>
        </div>
      )}

      <footer style={{textAlign:"center",marginTop:48,fontSize:12,color:"#334155",letterSpacing:"0.04em",padding:"0 20px"}}>
        Aayojan © 2024 · Newtown, Kolkata · Rajarhat · Action Area I, II & III · Salt Lake
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box;margin:0;padding:0; }
        body { background:#020817; }
        input[type=range]{-webkit-appearance:none;appearance:none;height:6px;border-radius:3px;background:#334155;outline:none;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;cursor:pointer;box-shadow:0 0 0 4px rgba(249,115,22,0.2);}
        @keyframes loadSlide{from{width:0%}to{width:90%}}
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
        button:hover{opacity:0.88;} input:focus{outline:none;} a{text-decoration:none;}
        ::-webkit-scrollbar{width:4px;height:4px;} ::-webkit-scrollbar-track{background:#0f172a;} ::-webkit-scrollbar-thumb{background:#334155;border-radius:2px;}
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root:{minHeight:"100vh",background:"#020817",fontFamily:"'DM Sans',sans-serif",color:"#e2e8f0",paddingBottom:60,position:"relative",overflow:"hidden"},
  bgGlow:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"radial-gradient(ellipse 90% 50% at 50% -10%,rgba(249,115,22,0.1) 0%,transparent 65%)",pointerEvents:"none"},
  overlay:{position:"fixed",inset:0,zIndex:200,background:"rgba(2,8,23,0.9)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20},
  modal:{background:"#0f172a",border:"1px solid rgba(249,115,22,0.2)",borderRadius:22,padding:"40px 36px",width:"100%",maxWidth:420,textAlign:"center",boxShadow:"0 40px 100px rgba(0,0,0,0.8)"},
  modalTitle:{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#fff",marginBottom:8},
  modalSub:{fontSize:14,color:"#64748b",marginBottom:28,lineHeight:1.6},
  phoneRow:{display:"flex",alignItems:"center",border:"1px solid #334155",borderRadius:12,overflow:"hidden",marginBottom:12,background:"#0a1628"},
  cc:{padding:"14px 12px",background:"#1e293b",color:"#94a3b8",fontSize:13,fontWeight:600,borderRight:"1px solid #334155",whiteSpace:"nowrap"},
  phoneInput:{flex:1,padding:"14px 16px",background:"transparent",border:"none",color:"#fff",fontSize:16,fontWeight:600,outline:"none"},
  otpRow:{display:"flex",gap:12,justifyContent:"center",marginBottom:12},
  otpBox:{width:58,height:62,textAlign:"center",fontSize:26,fontWeight:800,color:"#fff",background:"#0a1628",border:"2px solid",borderRadius:12,outline:"none",transition:"all 0.2s"},
  demoBadge:{background:"rgba(249,115,22,0.08)",border:"1px solid rgba(249,115,22,0.2)",borderRadius:8,padding:"8px 16px",fontSize:13,color:"#94a3b8",marginBottom:16},
  resendRow:{display:"flex",justifyContent:"center",gap:20,marginTop:16},
  linkBtn:{background:"none",border:"none",color:"#f97316",fontSize:13,cursor:"pointer",fontWeight:600},
  errMsg:{color:"#ef4444",fontSize:13,marginBottom:12},
  header:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",borderBottom:"1px solid rgba(255,255,255,0.05)",position:"sticky",top:0,background:"rgba(2,8,23,0.95)",backdropFilter:"blur(12px)",zIndex:100},
  logoBtn:{display:"flex",alignItems:"center",gap:12,background:"none",border:"none",cursor:"pointer",padding:0},
  logoMark:{fontSize:26,background:"linear-gradient(135deg,#f97316,#ef4444)",borderRadius:12,width:46,height:46,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 16px rgba(249,115,22,0.3)",flexShrink:0},
  brand:{fontFamily:"'Playfair Display',serif",fontSize:21,fontWeight:700,background:"linear-gradient(135deg,#fff 30%,#f97316)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
  tagline:{fontSize:11,color:"#64748b",marginTop:1},
  headerRight:{display:"flex",alignItems:"center",gap:8},
  ghostBtn:{background:"transparent",border:"1px solid #1e293b",color:"#64748b",padding:"7px 12px",borderRadius:8,fontSize:12,cursor:"pointer"},
  loginBtn:{background:"rgba(249,115,22,0.1)",border:"1px solid rgba(249,115,22,0.3)",color:"#f97316",padding:"7px 16px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"},
  userChip:{display:"flex",alignItems:"center",gap:5,background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#4ade80"},
  page:{maxWidth:820,margin:"0 auto",padding:"28px 18px"},
  card:{background:"rgba(15,23,42,0.95)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,padding:"32px 36px",backdropFilter:"blur(20px)",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"},
  hero:{textAlign:"center",padding:"36px 0 24px"},
  heroBadge:{display:"inline-block",background:"rgba(249,115,22,0.1)",border:"1px solid rgba(249,115,22,0.25)",borderRadius:20,padding:"5px 16px",fontSize:13,color:"#f97316",marginBottom:18},
  heroTitle:{fontFamily:"'Playfair Display',serif",fontSize:44,fontWeight:700,color:"#fff",lineHeight:1.15,marginBottom:14},
  heroAccent:{background:"linear-gradient(135deg,#f97316,#ef4444)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
  heroSub:{fontSize:16,color:"#64748b",maxWidth:500,margin:"0 auto 24px",lineHeight:1.6},
  heroCTA:{background:"linear-gradient(135deg,#f97316,#ef4444)",color:"#fff",border:"none",padding:"14px 32px",borderRadius:12,fontSize:16,fontWeight:700,cursor:"pointer",boxShadow:"0 6px 24px rgba(249,115,22,0.4)"},
  aiChatPromo:{display:"flex",alignItems:"center",gap:16,background:"linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.07))",border:"1px solid rgba(99,102,241,0.3)",borderRadius:16,padding:"18px 24px",maxWidth:600,margin:"0 auto",textAlign:"left",flexWrap:"wrap"},
  aiChatPromoLeft:{display:"flex",alignItems:"flex-start",gap:14,flex:1},
  svcGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16},
  svcCard:{border:"2px solid",borderRadius:18,padding:"26px 22px",cursor:"pointer",transition:"all 0.2s",textAlign:"left",display:"flex",flexDirection:"column",gap:10,background:"transparent"},
  svcCardIcon:{width:54,height:54,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26},
  svcCardLabel:{fontSize:19,fontWeight:800,fontFamily:"'Playfair Display',serif"},
  svcCardTagline:{fontSize:13,color:"#64748b",lineHeight:1.4},
  svcFeatures:{display:"flex",flexDirection:"column",gap:4},
  svcFeatureItem:{fontSize:12,fontWeight:500},
  svcCTA:{color:"#fff",border:"none",borderRadius:10,padding:"11px 0",fontSize:13,fontWeight:700,textAlign:"center",marginTop:6},
  statsRow:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:36},
  statCard:{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"18px 12px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:3},
  statVal:{fontSize:24,fontWeight:800,color:"#fff"},
  statLbl:{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.07em"},
  section:{marginBottom:44},
  sectionTitle:{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#fff",marginBottom:22},
  stepsGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12},
  howCard:{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"20px 14px",textAlign:"center"},
  howNum:{fontSize:10,fontWeight:800,color:"#f97316",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6},
  howTitle:{fontSize:14,fontWeight:700,color:"#fff",marginBottom:5},
  howDesc:{fontSize:11,color:"#64748b",lineHeight:1.5},
  featuredGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12},
  featCard:{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"18px"},
  featTop:{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10},
  featLogo:{fontSize:26,background:"#0f172a",borderRadius:10,width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  featName:{fontSize:14,fontWeight:700,color:"#fff",marginBottom:3},
  featMeta:{fontSize:11,color:"#64748b"},
  featPrice:{fontSize:13,color:"#f97316",fontWeight:700,marginTop:6},
  catBanner:{background:"linear-gradient(135deg,rgba(249,115,22,0.08),rgba(239,68,68,0.06))",border:"1px solid rgba(249,115,22,0.2)",borderRadius:18,padding:"32px 36px",display:"flex",gap:28,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"},
  formTitle:{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"#fff",marginTop:10,marginBottom:6},
  formSub:{fontSize:14,color:"#64748b",lineHeight:1.5},
  formGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18},
  fieldWrap:{display:"flex",flexDirection:"column",gap:5},
  fieldLabel:{fontSize:12,fontWeight:600,color:"#94a3b8",letterSpacing:"0.03em"},
  fieldInput:{background:"#0f172a",border:"1px solid",borderRadius:10,padding:"11px 14px",color:"#fff",fontSize:14,outline:"none",transition:"border-color 0.2s"},
  fieldErr:{fontSize:11,color:"#ef4444"},
  fieldHint:{fontSize:11,color:"#475569",lineHeight:1.5},
  selChip:{padding:"7px 14px",borderRadius:8,border:"1px solid #334155",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"},
  progressWrap:{display:"flex",alignItems:"center",justifyContent:"center",padding:"16px 16px 5px"},
  progDot:{width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",transition:"all 0.3s",zIndex:1},
  progLine:{width:38,height:2,transition:"background 0.3s"},
  stepLabels:{display:"flex",justifyContent:"center",padding:"3px 16px 18px"},
  stepLbl:{width:74,textAlign:"center",fontSize:9,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",transition:"color 0.3s"},
  cardTitle:{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,marginBottom:6,color:"#fff"},
  cardSub:{fontSize:14,color:"#64748b",marginBottom:22},
  eventGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:22},
  eventCard:{display:"flex",flexDirection:"column",alignItems:"center",gap:7,padding:"20px 12px",border:"2px solid",borderRadius:14,cursor:"pointer",transition:"all 0.2s",background:"transparent"},
  chipRow:{display:"flex",flexWrap:"wrap",gap:6},
  chip:{padding:"5px 11px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",border:"1px solid",transition:"all 0.15s"},
  chip2:{padding:"3px 9px",borderRadius:20,fontSize:10,background:"#1e293b",color:"#94a3b8",border:"1px solid #334155"},
  primaryBtn:{background:"linear-gradient(135deg,#f97316,#ef4444)",color:"#fff",border:"none",padding:"13px 26px",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 18px rgba(249,115,22,0.3)",width:"100%",marginTop:8},
  secondaryBtn:{background:"transparent",color:"#94a3b8",border:"1px solid #334155",padding:"12px 22px",borderRadius:10,fontSize:13,cursor:"pointer"},
  btnRow:{display:"flex",gap:10,marginTop:20,alignItems:"center"},
  // Chatbot styles
  chatWrap:{background:"rgba(15,23,42,0.98)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.5)",display:"flex",flexDirection:"column",height:"78vh",maxHeight:680},
  chatHeader:{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",background:"rgba(30,41,59,0.9)",borderBottom:"1px solid rgba(255,255,255,0.07)"},
  chatBotAvatar:{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0},
  chatMessages:{flex:1,overflowY:"auto",padding:"16px 16px 8px",display:"flex",flexDirection:"column",gap:0},
  botAvatarSmall:{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,marginRight:8,alignSelf:"flex-end",marginBottom:12},
  quickPrompts:{padding:"8px 14px",display:"flex",gap:7,flexWrap:"wrap",borderTop:"1px solid rgba(255,255,255,0.05)",background:"rgba(15,23,42,0.5)"},
  quickBtn:{fontSize:12,padding:"5px 11px",borderRadius:14,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)",color:"#818cf8",cursor:"pointer",whiteSpace:"nowrap"},
  chatInputRow:{display:"flex",gap:8,padding:"10px 14px",borderTop:"1px solid rgba(255,255,255,0.07)",background:"rgba(15,23,42,0.8)"},
  chatInput:{flex:1,background:"rgba(30,41,59,0.9)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"10px 14px",color:"#fff",fontSize:13,outline:"none",lineHeight:1.4},
  chatSendBtn:{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  orderConfirmCard:{background:"rgba(30,41,59,0.95)",border:"1px solid rgba(74,222,128,0.25)",borderRadius:14,padding:"14px 16px",margin:"8px 0 10px 36px"},
  orderConfirmTitle:{fontSize:12,fontWeight:700,color:"#4ade80",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10},
  orderConfirmGrid:{display:"flex",flexDirection:"column",gap:6},
  orderConfirmRow:{display:"flex",justifyContent:"space-between",fontSize:13},
};

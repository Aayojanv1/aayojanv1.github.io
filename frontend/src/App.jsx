import { useState, useEffect, useRef } from "react";

// ─── Geo Data ─────────────────────────────────────────────────────────────────
const PINCODE_COORDS = {
  "700156":{ lat:22.5894,lng:88.4802,area:"Action Area I, Newtown" },
  "700157":{ lat:22.5801,lng:88.4889,area:"Action Area II, Newtown" },
  "700135":{ lat:22.6052,lng:88.4657,area:"Rajarhat Gopalpur" },
  "700161":{ lat:22.5698,lng:88.5012,area:"Action Area III, Newtown" },
  "700136":{ lat:22.6150,lng:88.4720,area:"Baguiati" },
  "700059":{ lat:22.6280,lng:88.4350,area:"Salt Lake Sector V" },
  "700091":{ lat:22.6050,lng:88.4400,area:"Salt Lake City" },
  "700105":{ lat:22.5760,lng:88.4300,area:"EM Bypass, Kasba" },
  "700107":{ lat:22.5600,lng:88.4400,area:"Gariahat" },
  "700160":{ lat:22.5950,lng:88.4900,area:"Eco Park Zone" },
};
const haversineKm=(la1,ln1,la2,ln2)=>{const R=6371,dLat=((la2-la1)*Math.PI)/180,dLng=((ln2-ln1)*Math.PI)/180;const a=Math.sin(dLat/2)**2+Math.cos((la1*Math.PI)/180)*Math.cos((la2*Math.PI)/180)*Math.sin(dLng/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));};

// ─── Service Types ────────────────────────────────────────────────────────────
const SVC = {
  full:{ id:"full",label:"Full Catering Service",icon:"🍽️",minGuests:30,tagline:"30+ guests · Staff, cutlery & full setup",color:"#c0392b",grad:"linear-gradient(135deg,#fff5f5,#fee2e2)",border:"#fca5a5",btnGrad:"linear-gradient(135deg,#c0392b,#e74c3c)",accentRGB:"192,57,43",features:["Serving staff on-site","Cutlery, crockery & serveware","Live food counters","Setup, decoration & cleanup","Chafing dishes & buffet stands","Minimum 30 guests"],priceRange:{min:350,max:1800},priceLabel:"per plate (all-inclusive)" },
  bulk:{ id:"bulk",label:"Bulk Food Delivery",icon:"📦",minGuests:1,tagline:"Any quantity · Packed & delivered to you",color:"#b5451b",grad:"linear-gradient(135deg,#fff7ed,#ffedd5)",border:"#fdba74",btnGrad:"linear-gradient(135deg,#b5451b,#c0392b)",accentRGB:"181,69,27",features:["No minimum order","Food packed in containers","Home/venue delivery","No staff or setup included","Disposable cutlery on request","Faster turnaround"],priceRange:{min:120,max:600},priceLabel:"per portion (food only)" },
};

const ALL_CUISINES=["Bengali","Mughlai","North Indian","South Indian","Continental","Chinese","Kolkata Biryani","Vegetarian Only","Jain","Punjabi","Rajasthani","Street Food","Bakery & Desserts","Multi-cuisine"];

const SEED_CATERERS=[
  {id:"c1",name:"Bhojohori Manna Caterers",ownerName:"Subroto Das",phone:"9830012345",email:"subroto@bhojohori.in",address:"Plot 5A, Action Area I",pincode:"700156",specialty:["Wedding","Party","Religious"],cuisineSpecialties:["Bengali","Multi-cuisine"],serviceTypes:["full"],tags:["Bengali Cuisine","Multi-course"],priceRange:"₹₹₹",logo:"🪷",rating:4.8,turnaround:"2–3 hrs",registeredAt:"2024-01-10",active:true},
  {id:"c2",name:"Kolkata Dawat",ownerName:"Md. Irfan Ali",phone:"9736054321",email:"irfan@kolkatadawat.com",address:"EE-12, Action Area II",pincode:"700157",specialty:["Party","Corporate","Wedding"],cuisineSpecialties:["Mughlai","Kolkata Biryani","North Indian"],serviceTypes:["full","bulk"],tags:["Budget-friendly","Mughlai & Bengali"],priceRange:"₹₹",logo:"🍚",rating:4.6,turnaround:"1–2 hrs",registeredAt:"2024-02-05",active:true},
  {id:"c3",name:"Ananda Bhojan Events",ownerName:"Priya Chakraborty",phone:"9674011223",email:"priya@anandabhojan.com",address:"Eco Park Gate 2, Sector IV",pincode:"700160",specialty:["Wedding","Religious"],cuisineSpecialties:["Bengali","Vegetarian Only","Jain"],serviceTypes:["full"],tags:["Luxury","Live counters","Veg specialist"],priceRange:"₹₹₹₹",logo:"🎊",rating:4.9,turnaround:"3–4 hrs",registeredAt:"2024-01-22",active:true},
  {id:"c4",name:"Thakurbarir Ranna",ownerName:"Goutam Banerjee",phone:"9800167890",email:"goutam@thakurbarir.com",address:"K-7 Rajarhat Main Road",pincode:"700135",specialty:["Wedding","Religious","Party"],cuisineSpecialties:["Bengali","Vegetarian Only"],serviceTypes:["full","bulk"],tags:["Authentic Bengali","Vegetarian"],priceRange:"₹₹",logo:"🏛️",rating:4.7,turnaround:"2–3 hrs",registeredAt:"2024-03-01",active:true},
  {id:"c5",name:"Biryani & Beyond",ownerName:"Rajesh Sharma",phone:"9051022334",email:"rajesh@biryanibb.com",address:"Silicon Valley Tower 3",pincode:"700156",specialty:["Party","Corporate"],cuisineSpecialties:["Kolkata Biryani","Mughlai","North Indian"],serviceTypes:["bulk"],tags:["Kolkata Biryani","Non-veg specialist"],priceRange:"₹₹",logo:"🍖",rating:4.5,turnaround:"1–2 hrs",registeredAt:"2024-02-18",active:true},
  {id:"c6",name:"Sanmilani Grand Caterers",ownerName:"Debabrata Roy",phone:"9339044556",email:"deb@sanmilani.com",address:"New Town Connector, Block D",pincode:"700157",specialty:["Wedding","Party","Corporate","Religious"],cuisineSpecialties:["Bengali","North Indian","Continental","Multi-cuisine"],serviceTypes:["full","bulk"],tags:["Premium","Full-service","Pan-Bengali"],priceRange:"₹₹₹",logo:"👑",rating:4.8,turnaround:"2–4 hrs",registeredAt:"2024-01-30",active:true},
];

const DB={
  init:()=>{ if(!window.__aDB) window.__aDB={caterers:JSON.parse(JSON.stringify(SEED_CATERERS)),customers:[],quotationRequests:[],orders:[],chatOrders:[],payments:[]}; },
  get:()=>{DB.init();return window.__aDB;},
  saveCaterer:(c)=>{DB.init();window.__aDB.caterers.push(c);},
  saveCustomer:(c)=>{DB.init();window.__aDB.customers.push(c);},
  saveQR:(q)=>{DB.init();window.__aDB.quotationRequests.push(q);},
  saveOrder:(o)=>{DB.init();window.__aDB.orders.push(o);},
  saveChatOrder:(o)=>{DB.init();window.__aDB.chatOrders.push(o);},
  savePayment:(p)=>{DB.init();window.__aDB.payments.push(p);},
  hasUnlockedPhone:(customerId,catererId)=>DB.get().payments.some(p=>p.customerId===customerId&&p.catererId===catererId&&p.type==="phone_unlock"&&p.status==="success"),
  getCaterers:()=>DB.get().caterers.filter(c=>c.active),
};

const MENU_ITEMS={
  Starters:["Fish Fry","Veg Chop","Egg Devil","Dahi Vada","Aloo Tikki","Prawn Cocktail","Chicken Cutlet"],
  "Main Course":["Sorshe Ilish","Chingri Malai Curry","Kosha Mangsho","Dal Makhani","Paneer Butter Masala","Begun Bhaja","Mutton Curry"],
  "Bengali Specials":["Luchi-Alur Dom","Cholar Dal","Shukto","Mochar Ghonto","Dharosh Posto","Aloo Posto"],
  Breads:["Luchi","Tandoori Roti","Paratha","Naan","Puri"],
  Rice:["Steamed Rice","Kolkata Biryani","Basanti Pulao","Jeera Rice","Curd Rice"],
  Desserts:["Mishti Doi","Rasgolla","Sandesh","Payesh","Gulab Jamun","Malpua","Ice Cream Counter"],
  Beverages:["Aam Panna","Thandai","Lassi","Soft Drinks","Masala Chai","Fresh Coconut Water"],
};

const EVENT_TYPES=[
  {id:"wedding",label:"Wedding",icon:"💍",desc:"Biye, annaprasan & grand receptions"},
  {id:"party",label:"Party",icon:"🎉",desc:"Birthday, anniversary & get-togethers"},
  {id:"corporate",label:"Corporate",icon:"🏢",desc:"Office events & team lunches"},
  {id:"religious",label:"Religious",icon:"🪔",desc:"Pujo, brata & community feasts"},
];

const STEPS=["Service","Location","Event","Guests & Budget","Menu","Quotes","Order"];
const DEMO_OTP="1234",BASE_KM=5,KM_RATE=20,WAIT_HRS=48;
const PHONE_UNLOCK_FEE=99;
const FOOD_TASTING_FEE=199;

const buildWAMsg=(caterer,req)=>{
  const exp=new Date(new Date(req.sentAt).getTime()+WAIT_HRS*3600000);
  return encodeURIComponent(`🎉 *New Quote Request — Aayojan*\n\nHello *${caterer.ownerName}*,\n\n📋 *Request:* ${req.id}\n🛎️ *Service:* ${req.serviceType==="full"?"Full Catering Service":"Bulk Food Delivery"}\n🎊 *Event:* ${req.eventType}\n👥 *Guests:* ${req.guestCount}\n💰 *Budget:* ₹${req.perPlateBudget}/${req.serviceType==="full"?"plate":"portion"}\n📍 *Pincode:* ${req.customerPincode}\n🍽️ *Menu:* ${req.menuItems.slice(0,5).join(", ")}\n\n⏰ Respond within 48 hrs · Deadline: ${exp.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}\n— Team Aayojan`);
};

// ─── Payment Gateway Component ─────────────────────────────────────────────────
function PaymentGateway({amount,purpose,catererName,onSuccess,onCancel}){
  const [step,setStep]=useState("method"); // method | card | upi | processing | done
  const [card,setCard]=useState({number:"",expiry:"",cvv:"",name:""});
  const [upi,setUpi]=useState("");
  const [cardErrors,setCardErrors]=useState({});
  const [processing,setProcessing]=useState(false);

  const formatCard=(v)=>v.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();
  const formatExpiry=(v)=>{const d=v.replace(/\D/g,"").slice(0,4);return d.length>2?d.slice(0,2)+"/"+d.slice(2):d;};

  const processPayment=()=>{
    if(step==="card"){
      const e={};
      if(card.number.replace(/\s/g,"").length<16) e.number="Enter valid 16-digit card number";
      if(card.expiry.length<5) e.expiry="Enter valid expiry MM/YY";
      if(card.cvv.length<3) e.cvv="Enter 3-digit CVV";
      if(!card.name.trim()) e.name="Enter name on card";
      if(Object.keys(e).length){setCardErrors(e);return;}
    }
    if(step==="upi"&&!/^[\w.\-]+@[\w]+$/.test(upi)){setCardErrors({upi:"Enter valid UPI ID (e.g. 9830012345@upi)"});return;}
    setProcessing(true);
    setStep("processing");
    setTimeout(()=>{setStep("done");setProcessing(false);setTimeout(()=>onSuccess(),1200);},2200);
  };

  const RupeeIcon=()=><span style={{fontWeight:900}}>₹</span>;

  return(
    <div style={PG.overlay}>
      <div style={PG.modal}>
        {/* Header */}
        <div style={PG.header}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={PG.pgLogo}>🔒</div>
            <div><div style={{fontWeight:800,color:"#c0392b",fontSize:16}}>Aayojan Pay</div><div style={{fontSize:11,color:"#6b7280"}}>Secure Payment Gateway</div></div>
          </div>
          {step!=="processing"&&step!=="done"&&<button onClick={onCancel} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#9ca3af"}}>✕</button>}
        </div>

        {/* Amount banner */}
        <div style={PG.amountBanner}>
          <div style={{fontSize:12,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{purpose}</div>
          <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
            <span style={{fontSize:42,fontWeight:900,color:"#c0392b",fontFamily:"'Playfair Display',serif",lineHeight:1}}>₹{amount}</span>
          </div>
          {catererName&&<div style={{fontSize:13,color:"#6b7280",marginTop:4}}>For: <strong style={{color:"#374151"}}>{catererName}</strong></div>}
        </div>

        {step==="method"&&(
          <div style={{padding:"0 20px 20px"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:12}}>Choose Payment Method</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[["💳","Debit / Credit Card","Visa, Mastercard, RuPay"],["📱","UPI","PhonePe, GPay, Paytm"],["🏦","Net Banking","All major banks"]].map(([icon,lbl,sub],i)=>(
                <button key={i} onClick={()=>setStep(i===0?"card":"upi")} style={PG.methodBtn}>
                  <span style={{fontSize:24}}>{icon}</span>
                  <div style={{textAlign:"left"}}><div style={{fontWeight:700,color:"#1f2937",fontSize:14}}>{lbl}</div><div style={{fontSize:12,color:"#9ca3af"}}>{sub}</div></div>
                  <span style={{marginLeft:"auto",color:"#c0392b",fontSize:18}}>›</span>
                </button>
              ))}
            </div>
            <div style={PG.secureRow}><span>🔒</span><span>256-bit SSL encrypted · PCI-DSS compliant</span></div>
          </div>
        )}

        {step==="card"&&(
          <div style={{padding:"0 20px 20px"}}>
            <button onClick={()=>{setStep("method");setCardErrors({});}} style={PG.backLink}>← Back</button>
            <div style={PG.cardPreview}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginBottom:8,letterSpacing:"0.1em"}}>DEBIT / CREDIT CARD</div>
              <div style={{fontSize:20,fontWeight:700,letterSpacing:"0.18em",color:"#fff",marginBottom:12}}>{card.number||"•••• •••• •••• ••••"}</div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,0.8)"}}>
                <span>{card.name||"CARD HOLDER"}</span><span>{card.expiry||"MM/YY"}</span>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div><label style={PG.lbl}>Card Number</label>
                <input style={{...PG.inp,borderColor:cardErrors.number?"#ef4444":"#e5e7eb"}} value={card.number} onChange={e=>setCard({...card,number:formatCard(e.target.value)})} placeholder="1234 5678 9012 3456" maxLength={19}/>
                {cardErrors.number&&<div style={PG.ferr}>{cardErrors.number}</div>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={PG.lbl}>Expiry</label>
                  <input style={{...PG.inp,borderColor:cardErrors.expiry?"#ef4444":"#e5e7eb"}} value={card.expiry} onChange={e=>setCard({...card,expiry:formatExpiry(e.target.value)})} placeholder="MM/YY" maxLength={5}/>
                  {cardErrors.expiry&&<div style={PG.ferr}>{cardErrors.expiry}</div>}
                </div>
                <div><label style={PG.lbl}>CVV</label>
                  <input style={{...PG.inp,borderColor:cardErrors.cvv?"#ef4444":"#e5e7eb"}} type="password" value={card.cvv} onChange={e=>setCard({...card,cvv:e.target.value.replace(/\D/g,"").slice(0,3)})} placeholder="•••" maxLength={3}/>
                  {cardErrors.cvv&&<div style={PG.ferr}>{cardErrors.cvv}</div>}
                </div>
              </div>
              <div><label style={PG.lbl}>Name on Card</label>
                <input style={{...PG.inp,borderColor:cardErrors.name?"#ef4444":"#e5e7eb"}} value={card.name} onChange={e=>setCard({...card,name:e.target.value.toUpperCase()})} placeholder="AS ON CARD"/>
                {cardErrors.name&&<div style={PG.ferr}>{cardErrors.name}</div>}
              </div>
              <button onClick={processPayment} style={PG.payBtn}>Pay ₹{amount} Securely 🔒</button>
            </div>
          </div>
        )}

        {(step==="upi")&&(
          <div style={{padding:"0 20px 20px"}}>
            <button onClick={()=>{setStep("method");setCardErrors({});}} style={PG.backLink}>← Back</button>
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:16}}>
                {["PhonePe","GPay","Paytm","BHIM"].map(app=><div key={app} style={{textAlign:"center",fontSize:10,color:"#6b7280"}}><div style={{width:44,height:44,borderRadius:12,background:"#f3f4f6",border:"1px solid #e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:4}}>{app==="PhonePe"?"💜":app==="GPay"?"🔵":app==="Paytm"?"🔷":"🟢"}</div>{app}</div>)}
              </div>
              <label style={PG.lbl}>Enter UPI ID</label>
              <input style={{...PG.inp,borderColor:cardErrors.upi?"#ef4444":"#e5e7eb"}} value={upi} onChange={e=>{setUpi(e.target.value);setCardErrors({});}} placeholder="yourname@upi or 9830012345@upi"/>
              {cardErrors.upi&&<div style={PG.ferr}>{cardErrors.upi}</div>}
            </div>
            <button onClick={processPayment} style={PG.payBtn}>Pay ₹{amount} via UPI 📱</button>
            <div style={PG.secureRow}><span>🔒</span><span>256-bit SSL encrypted · PCI-DSS compliant</span></div>
          </div>
        )}

        {step==="processing"&&(
          <div style={{padding:"30px 20px 40px",textAlign:"center"}}>
            <div style={{width:60,height:60,borderRadius:"50%",border:"4px solid #f3f4f6",borderTop:"4px solid #c0392b",margin:"0 auto 20px",animation:"pgSpin 0.8s linear infinite"}}/>
            <div style={{fontSize:18,fontWeight:700,color:"#1f2937",marginBottom:6}}>Processing Payment...</div>
            <div style={{fontSize:13,color:"#9ca3af"}}>Please do not close this window</div>
          </div>
        )}

        {step==="done"&&(
          <div style={{padding:"30px 20px 36px",textAlign:"center"}}>
            <div style={{fontSize:56,marginBottom:12}}>✅</div>
            <div style={{fontSize:20,fontWeight:800,color:"#16a34a",marginBottom:4}}>Payment Successful!</div>
            <div style={{fontSize:14,color:"#6b7280"}}>₹{amount} paid · Unlocking details...</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Budget Slider ────────────────────────────────────────────────────────────
function BudgetSlider({svcType,value,onChange}){
  const cfg=SVC[svcType];
  const {min,max}=cfg.priceRange;
  const pct=((value-min)/(max-min))*100;
  const tier=pct<33?{label:"💚 Budget-friendly",color:"#16a34a"}:pct<66?{label:"🟠 Mid-range",color:"#ea580c"}:{label:"💜 Premium",color:"#9333ea"};
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12}}>
        <div>
          <div style={{fontSize:12,color:"#6b7280",marginBottom:3}}>{cfg.priceLabel}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:6}}>
            <span style={{fontSize:48,fontWeight:900,color:cfg.color,fontFamily:"'Playfair Display',serif",lineHeight:1}}>₹{value}</span>
            <span style={{fontSize:14,color:"#9ca3af"}}>/ {svcType==="full"?"plate":"portion"}</span>
          </div>
        </div>
        <div style={{textAlign:"right"}}><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:2}}>Range</div><div style={{fontSize:13,fontWeight:700,color:tier.color}}>{tier.label}</div></div>
      </div>
      <input type="range" min={min} max={max} step={10} value={value} onChange={e=>onChange(Number(e.target.value))} style={{width:"100%",accentColor:cfg.color,marginBottom:6}}/>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#9ca3af",marginBottom:14}}><span>₹{min}</span><span>₹{max}</span></div>
      <div style={{background:"#fff8f5",border:"1px solid #fde8d8",borderRadius:10,padding:"12px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,textAlign:"center"}}>
        {[[`Per ${svcType==="full"?"plate":"portion"}`,`₹${value}`],["50 guests",`₹${(value*50).toLocaleString()}`],["100 guests",`₹${(value*100).toLocaleString()}`],["200 guests",`₹${(value*200).toLocaleString()}`]].map(([lbl,val])=>(
          <div key={lbl}><div style={{fontSize:14,fontWeight:800,color:cfg.color}}>{val}</div><div style={{fontSize:10,color:"#9ca3af",marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>{lbl}</div></div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Chatbot ───────────────────────────────────────────────────────────────
function AayojanChatbot({onOrderCreated,user,onLoginRequired}){
  const [msgs,setMsgs]=useState([{role:"assistant",text:"নমস্কার! 🙏 I'm **Aayojan AI** — your catering assistant for Newtown, Kolkata!\n\nTell me about your event: guests, budget, cuisine preferences, and I'll create your custom catering order.\n\nTry: *\"I need catering for 150 guests at a wedding, budget ₹600 per plate, Action Area I\"*"}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [orderData,setOrderData]=useState(null);
  const [confirmed,setConfirmed]=useState(false);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const SYSTEM=`You are Aayojan AI, a catering assistant for Newtown, Kolkata. Collect: 1) service type (full catering 30+ guests with staff/cutlery, OR bulk delivery any quantity packed), 2) event type, 3) guest count, 4) per-plate budget ₹350-1800 full / ₹120-600 bulk, 5) menu items, 6) pincode (700156-Action Area I, 700157-Action Area II, 700135-Rajarhat, 700161-Action Area III, 700136-Baguiati, 700059-Salt Lake V, 700091-Salt Lake, 700105-EM Bypass, 700107-Gariahat, 700160-Eco Park). Be warm, suggest Bengali dishes (Sorshe Ilish, Kosha Mangsho, Mishti Doi, Rasgolla). When you have ALL info output: ###ORDER_JSON###{"serviceType":"full","eventType":"wedding","guestCount":150,"perPlateBudget":600,"menuItems":["Sorshe Ilish","Mishti Doi"],"pincode":"700156","summary":"..."}###END_JSON### Keep replies to 2-3 sentences.`;

  const sendMessage=async()=>{
    const text=input.trim();if(!text||loading)return;
    setInput("");const newMsgs=[...msgs,{role:"user",text}];setMsgs(newMsgs);setLoading(true);
    try{
      const API_URL=import.meta.env.VITE_API_URL||"http://localhost:8000";
      const res=await fetch(`${API_URL}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:newMsgs.map(m=>({role:m.role,content:m.text.replace(/###ORDER_JSON###[\s\S]*?###END_JSON###/g,"").trim()})),system_prompt:SYSTEM})});
      const data=await res.json();
      const reply=data.reply||"Sorry, try again.";
      const jm=reply.match(/###ORDER_JSON###\s*([\s\S]*?)\s*###END_JSON###/);
      if(jm){try{setOrderData(JSON.parse(jm[1]));}catch(e){}}
      setMsgs(prev=>[...prev,{role:"assistant",text:reply.replace(/###ORDER_JSON###[\s\S]*?###END_JSON###/g,"").trim()}]);
    }catch(e){setMsgs(prev=>[...prev,{role:"assistant",text:"⚠️ Connection error. Please try again."}]);}
    setLoading(false);
  };

  const confirmOrder=()=>{
    if(!user){onLoginRequired();return;}
    const order={id:`CHAT-${Date.now()}`,source:"chatbot",customerId:user.id,customerPhone:user.phone,...orderData,status:"Quotation Requested",placedAt:new Date().toISOString()};
    DB.saveChatOrder(order);onOrderCreated(order);setConfirmed(true);
    setMsgs(prev=>[...prev,{role:"assistant",text:`✅ **Order placed!** ID: **${order.id}**\n\nWe'll contact caterers and reach you at ${user.phone} within 48 hours. Dhonnobad! 🙏`}]);setOrderData(null);
  };

  const renderText=(text)=>text.split('\n').map((line,i)=>{
    const parts=line.split(/(\*\*[^*]+\*\*)/g);
    return(<span key={i}>{parts.map((p,j)=>p.startsWith('**')&&p.endsWith('**')?<strong key={j} style={{color:"#1f2937"}}>{p.slice(2,-2)}</strong>:<span key={j}>{p}</span>)}{i<text.split('\n').length-1&&<br/>}</span>);
  });

  return(
    <div style={{background:"#fff",border:"1px solid #fde8d8",borderRadius:18,overflow:"hidden",boxShadow:"0 8px 30px rgba(192,57,43,0.12)",display:"flex",flexDirection:"column",height:"76vh",maxHeight:660}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",background:"linear-gradient(135deg,#c0392b,#e74c3c)"}}>
        <div style={{width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🤖</div>
        <div><div style={{fontWeight:800,color:"#fff",fontSize:15}}>Aayojan AI</div><div style={{fontSize:11,color:"rgba(255,255,255,0.8)",display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:"#4ade80",display:"inline-block"}}/>Online · Catering Expert</div></div>
        <div style={{marginLeft:"auto",fontSize:11,color:"rgba(255,255,255,0.7)",textAlign:"right"}}><div>Powered by</div><div style={{fontWeight:700,color:"#fff"}}>Gemini AI</div></div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px",display:"flex",flexDirection:"column",gap:0,background:"#fafafa"}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:10}}>
            {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#c0392b,#e74c3c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginRight:8,alignSelf:"flex-end",marginBottom:2}}>🤖</div>}
            <div style={{maxWidth:"82%",background:m.role==="user"?"linear-gradient(135deg,#c0392b,#e74c3c)":"#fff",color:m.role==="user"?"#fff":"#374151",borderRadius:m.role==="user"?"16px 16px 3px 16px":"16px 16px 16px 3px",padding:"10px 14px",fontSize:13,lineHeight:1.55,boxShadow:m.role==="assistant"?"0 1px 4px rgba(0,0,0,0.08)":"none",border:m.role==="assistant"?"1px solid #f3f4f6":"none"}}>
              {renderText(m.text)}
            </div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",gap:8,alignItems:"center"}}><div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#c0392b,#e74c3c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginRight:8}}>🤖</div><div style={{background:"#fff",border:"1px solid #f3f4f6",borderRadius:"16px 16px 16px 3px",padding:"10px 14px",display:"flex",gap:4,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#d1d5db",animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div></div>}
        {orderData&&!confirmed&&(
          <div style={{background:"#fff",border:"2px solid #c0392b",borderRadius:14,padding:"14px",margin:"8px 0 8px 34px",boxShadow:"0 2px 12px rgba(192,57,43,0.1)"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#c0392b",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>📋 Order Summary — Ready?</div>
            {[["🛎️ Service",SVC[orderData.serviceType]?.label||orderData.serviceType],["🎊 Event",orderData.eventType],["👥 Guests",orderData.guestCount],["💰 Budget",`₹${orderData.perPlateBudget}/${orderData.serviceType==="full"?"plate":"portion"}`],["📍 Pincode",orderData.pincode],["🍽️ Menu",`${orderData.menuItems?.length||0} items`]].map(([lbl,val])=>(
              <div key={lbl} style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}><span style={{color:"#6b7280"}}>{lbl}</span><span style={{color:"#1f2937",fontWeight:600,textTransform:"capitalize"}}>{val}</span></div>
            ))}
            {orderData.menuItems?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,margin:"8px 0"}}>{orderData.menuItems.map(item=><span key={item} style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:"#fff5f5",color:"#c0392b",border:"1px solid #fca5a5"}}>{item}</span>)}</div>}
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={()=>setOrderData(null)} style={{flex:1,padding:"9px",borderRadius:8,background:"#f9fafb",border:"1px solid #e5e7eb",color:"#6b7280",cursor:"pointer",fontSize:12}}>Edit</button>
              <button onClick={confirmOrder} style={{flex:2,padding:"9px",borderRadius:8,background:"linear-gradient(135deg,#16a34a,#15803d)",border:"none",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>✅ Confirm & Send</button>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      {msgs.length===1&&<div style={{padding:"6px 12px 4px",display:"flex",gap:6,flexWrap:"wrap",borderTop:"1px solid #f3f4f6",background:"#fff"}}>
        {["🎂 Birthday party, 50 guests","💍 Wedding, 200 guests","📦 Bulk delivery, 30 portions","🪔 Durga Puja feast, 100 people"].map(p=><button key={p} onClick={()=>{setInput(p);setTimeout(()=>inputRef.current?.focus(),50);}} style={{fontSize:11,padding:"5px 10px",borderRadius:12,background:"#fff5f5",border:"1px solid #fca5a5",color:"#c0392b",cursor:"pointer",whiteSpace:"nowrap"}}>{p}</button>)}
      </div>}
      <div style={{display:"flex",gap:8,padding:"10px 12px",borderTop:"1px solid #f3f4f6",background:"#fff"}}>
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()} placeholder="Describe your event, guests, budget..." style={{flex:1,background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:12,padding:"10px 14px",color:"#1f2937",fontSize:13,outline:"none"}}/>
        <button onClick={sendMessage} disabled={!input.trim()||loading} style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#c0392b,#e74c3c)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:input.trim()&&!loading?1:0.4}}>➤</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function AayojanApp(){
  const [view,setView]=useState("landing");
  const [animIn,setAnimIn]=useState(true);

  // Auth
  const [authStage,setAuthStage]=useState("idle");
  const [phone,setPhone]=useState("");
  const [otp,setOtp]=useState(["","","",""]);
  const [otpError,setOtpError]=useState("");
  const [phoneError,setPhoneError]=useState("");
  const [otpTimer,setOtpTimer]=useState(0);
  const [user,setUser]=useState(null);
  const timerRef=useRef(null);
  const otpRefs=[useRef(),useRef(),useRef(),useRef()];

  // Service & flow
  const [serviceType,setServiceType]=useState(null);
  const [step,setStep]=useState(0);
  const [customerPincode,setCustomerPincode]=useState("");
  const [pincodeError,setPincodeError]=useState("");
  const [customerCoords,setCustomerCoords]=useState(null);
  const [eventType,setEventType]=useState(null);
  const [guestCount,setGuestCount]=useState(100);
  const [perPlateBudget,setPerPlateBudget]=useState(500);
  const [selectedItems,setSelectedItems]=useState([]);
  const [customItem,setCustomItem]=useState("");
  const [nearbyCaterers,setNearbyCaterers]=useState([]);
  const [quotes,setQuotes]=useState([]);
  const [loading,setLoading]=useState(false);
  const [expandedCaterer,setExpandedCaterer]=useState(null);
  const [copiedCode,setCopiedCode]=useState(null);
  const [selectedQuote,setSelectedQuote]=useState(null);
  const [quotationRequest,setQuotationRequest]=useState(null);
  const [whatsappSent,setWhatsappSent]=useState([]);

  // Payment
  const [paymentModal,setPaymentModal]=useState(null); // {amount,purpose,catererId,type,onSuccess}
  const [unlockedPhones,setUnlockedPhones]=useState({}); // {catererId: phone}
  const [tastingBooked,setTastingBooked]=useState({});

  // Order
  const [deliveryAddress,setDeliveryAddress]=useState({flat:"",building:"",street:"",landmark:"",pincode:"",city:"Kolkata",state:"West Bengal"});
  const [addressErrors,setAddressErrors]=useState({});
  const [orderPlaced,setOrderPlaced]=useState(null);
  const [chatOrderConfirmed,setChatOrderConfirmed]=useState(null);

  // Registration
  const [regForm,setRegForm]=useState({name:"",ownerName:"",phone:"",email:"",address:"",pincode:"",specialty:[],cuisineSpecialties:[],serviceTypes:[],priceRange:"₹₹",turnaround:"2–3 hrs"});
  const [regErrors,setRegErrors]=useState({});
  const [regSuccess,setRegSuccess]=useState(false);

  // DB
  const [dbTab,setDbTab]=useState("caterers");
  const [dbData,setDbData]=useState({caterers:[],customers:[],quotationRequests:[],orders:[],chatOrders:[],payments:[]});

  useEffect(()=>{DB.init();setAnimIn(false);const t=setTimeout(()=>setAnimIn(true),60);return()=>clearTimeout(t);},[view,step,authStage]);
  useEffect(()=>{if(serviceType) setPerPlateBudget(SVC[serviceType].priceRange.min+100);},[serviceType]);
  useEffect(()=>{if(otpTimer>0){timerRef.current=setTimeout(()=>setOtpTimer(t=>t-1),1000);}return()=>clearTimeout(timerRef.current);},[otpTimer]);

  const navigate=(v)=>{setAnimIn(false);setTimeout(()=>{setView(v);setAnimIn(true);},80);};
  const anim={opacity:animIn?1:0,transform:animIn?"translateY(0)":"translateY(18px)",transition:"opacity 0.32s ease,transform 0.32s ease"};
  const stCfg=serviceType?SVC[serviceType]:SVC.full;
  const accent=stCfg.color;
  const accentGrad=stCfg.btnGrad;

  // ── OTP ──────────────────────────────────────────────────────────────────
  const handleSendOtp=()=>{const c=phone.replace(/\D/g,"");if(c.length!==10){setPhoneError("Enter valid 10-digit number.");return;}setPhoneError("");setOtp(["","","",""]);setOtpError("");setAuthStage("otp");setOtpTimer(30);setTimeout(()=>otpRefs[0].current?.focus(),150);};
  const handleOtpChange=(val,idx)=>{if(!/^\d?$/.test(val))return;const n=[...otp];n[idx]=val;setOtp(n);setOtpError("");if(val&&idx<3)otpRefs[idx+1].current?.focus();};
  const handleOtpKey=(e,idx)=>{if(e.key==="Backspace"&&!otp[idx]&&idx>0)otpRefs[idx-1].current?.focus();};
  const handleVerifyOtp=()=>{const entered=otp.join("");if(entered.length<4){setOtpError("Enter 4-digit OTP.");return;}if(entered!==DEMO_OTP){setOtpError("Incorrect OTP. Use 1234.");return;}const nu={id:`cu_${Date.now()}`,phone:`+91 ${phone.slice(0,5)} ${phone.slice(5)}`,registeredAt:new Date().toISOString()};if(!DB.get().customers.find(c=>c.phone===phone))DB.saveCustomer(nu);setUser(nu);setAuthStage("verified");setOtpError("");};
  const handleResendOtp=()=>{setOtp(["","","",""]);setOtpError("");setOtpTimer(30);setTimeout(()=>otpRefs[0].current?.focus(),100);};

  // ── Pincode ───────────────────────────────────────────────────────────────
  const handlePincodeNext=()=>{
    const coords=PINCODE_COORDS[customerPincode.trim()];
    if(customerPincode.trim().length!==6||!coords){setPincodeError("Enter a valid Newtown/Kolkata pincode");return;}
    setPincodeError("");setCustomerCoords(coords);
    const withDist=DB.getCaterers().filter(c=>!serviceType||(c.serviceTypes||["full"]).includes(serviceType)).map(c=>{const cc=PINCODE_COORDS[c.pincode];const dist=cc?Math.round(haversineKm(coords.lat,coords.lng,cc.lat,cc.lng)*10)/10:99;const extraKm=Math.max(0,dist-BASE_KM);return{...c,distanceKm:dist,extraKm:parseFloat(extraKm.toFixed(1)),surcharge:Math.round(extraKm*KM_RATE)};}).sort((a,b)=>a.distanceKm-b.distanceKm);
    setNearbyCaterers(withDist);setStep(2);
  };

  // ── Quotes ────────────────────────────────────────────────────────────────
  const generateQuotes=()=>{
    if(authStage!=="verified"){setAuthStage("phone");return;}
    setLoading(true);
    setTimeout(()=>{
      const matched=nearbyCaterers.filter(c=>c.specialty.map(s=>s.toLowerCase()).includes(eventType)).slice(0,5).map(c=>{const v=(Math.random()-0.3)*0.3;const ppa=Math.max(SVC[serviceType].priceRange.min,Math.round((perPlateBudget*(1+v))/10)*10);const base=ppa*guestCount;const tf=c.surcharge*Math.ceil(guestCount/50);return{...c,quoteCode:`${c.id.toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`,perPlateActual:ppa,basePrice:base,travelSurcharge:tf,totalPrice:base+tf,itemsCovered:selectedItems.length,withinBudget:ppa<=perPlateBudget};}).sort((a,b)=>a.perPlateActual-b.perPlateActual);
      const now=new Date();const qr={id:`QR-${Date.now()}`,customerId:user?.id,customerPhone:user?.phone,catererIds:matched.map(c=>c.id),eventType,serviceType,guestCount,perPlateBudget,menuItems:selectedItems,customerPincode,sentAt:now.toISOString(),expiresAt:new Date(now.getTime()+WAIT_HRS*3600000).toISOString(),status:"Awaiting Responses",whatsappLog:matched.map(c=>({catererId:c.id,catererName:c.name,maskedPhone:`${String(c.phone).slice(0,5)}•••••`,sentAt:now.toISOString(),status:"Sent ✅"}))};
      DB.saveQR(qr);setQuotationRequest(qr);setWhatsappSent(qr.whatsappLog);setQuotes(matched);setLoading(false);setStep(5);
    },1800);
  };

  // ── Payment handlers ──────────────────────────────────────────────────────
  const handleUnlockPhone=(caterer)=>{
    if(!user){setAuthStage("phone");return;}
    if(unlockedPhones[caterer.id]){return;}
    setPaymentModal({amount:PHONE_UNLOCK_FEE,purpose:`Unlock ${caterer.name}'s contact number`,catererId:caterer.id,type:"phone_unlock",catererName:caterer.name,
      onSuccess:()=>{
        const payment={id:`PAY-${Date.now()}`,customerId:user.id,catererId:caterer.id,catererName:caterer.name,type:"phone_unlock",amount:PHONE_UNLOCK_FEE,status:"success",paidAt:new Date().toISOString()};
        DB.savePayment(payment);
        setUnlockedPhones(prev=>({...prev,[caterer.id]:caterer.phone}));
        setPaymentModal(null);
      }
    });
  };

  const handleFoodTasting=(caterer)=>{
    if(!user){setAuthStage("phone");return;}
    if(tastingBooked[caterer.id]){return;}
    setPaymentModal({amount:FOOD_TASTING_FEE,purpose:`Book Food Tasting Session with ${caterer.name}`,catererId:caterer.id,type:"food_tasting",catererName:caterer.name,
      onSuccess:()=>{
        const payment={id:`PAY-${Date.now()}`,customerId:user.id,catererId:caterer.id,catererName:caterer.name,type:"food_tasting",amount:FOOD_TASTING_FEE,status:"success",paidAt:new Date().toISOString()};
        DB.savePayment(payment);
        setTastingBooked(prev=>({...prev,[caterer.id]:true}));
        setPaymentModal(null);
      }
    });
  };

  // ── Order ─────────────────────────────────────────────────────────────────
  const validateAddress=()=>{const e={};if(!deliveryAddress.flat.trim())e.flat="Required";if(!deliveryAddress.building.trim())e.building="Required";if(!deliveryAddress.street.trim())e.street="Required";if(!deliveryAddress.pincode.trim()||deliveryAddress.pincode.length!==6)e.pincode="Valid 6-digit pincode required";setAddressErrors(e);return Object.keys(e).length===0;};
  const placeOrder=()=>{if(!validateAddress())return;const order={id:`ORD-${Date.now()}`,quotationRequestId:quotationRequest?.id,customerId:user?.id,customerPhone:user?.phone,catererId:selectedQuote.id,catererName:selectedQuote.name,eventType,serviceType,guestCount,perPlateBudget,perPlateActual:selectedQuote.perPlateActual,menuItems:selectedItems,deliveryAddress:`${deliveryAddress.flat}, ${deliveryAddress.building}, ${deliveryAddress.street}${deliveryAddress.landmark?", "+deliveryAddress.landmark:""}, ${deliveryAddress.city} - ${deliveryAddress.pincode}`,deliveryPincode:deliveryAddress.pincode,distanceKm:selectedQuote.distanceKm,basePrice:selectedQuote.basePrice,travelSurcharge:selectedQuote.travelSurcharge,totalPrice:selectedQuote.totalPrice,quoteCode:selectedQuote.quoteCode,status:"Confirmed",placedAt:new Date().toISOString()};DB.saveOrder(order);setOrderPlaced(order);setStep(6);};

  // ── Registration ──────────────────────────────────────────────────────────
  const validateReg=()=>{const e={};if(!regForm.name.trim())e.name="Required";if(!regForm.ownerName.trim())e.ownerName="Required";if(!/^\d{10}$/.test(regForm.phone))e.phone="Valid 10-digit number";if(!regForm.email.includes("@"))e.email="Valid email required";if(!regForm.address.trim())e.address="Required";if(!PINCODE_COORDS[regForm.pincode.trim()])e.pincode="Valid Kolkata pincode";if(regForm.specialty.length===0)e.specialty="Select at least one";if(regForm.cuisineSpecialties.length===0)e.cuisineSpecialties="Select at least one";if(regForm.serviceTypes.length===0)e.serviceTypes="Select at least one";setRegErrors(e);return Object.keys(e).length===0;};
  const submitReg=()=>{if(!validateReg())return;const logos=["🍽️","🥘","🫕","🥗","🍛","🥞","🎂"];DB.saveCaterer({id:`c${Date.now()}`,...regForm,pincode:regForm.pincode.trim(),logo:logos[Math.floor(Math.random()*logos.length)],tags:regForm.cuisineSpecialties.slice(0,3),rating:4.0,registeredAt:new Date().toISOString().split("T")[0],active:true});setRegSuccess(true);};

  const copyCode=(code)=>{navigator.clipboard?.writeText(code);setCopiedCode(code);setTimeout(()=>setCopiedCode(null),2000);};
  const toggleItem=(item)=>setSelectedItems(prev=>prev.includes(item)?prev.filter(i=>i!==item):[...prev,item]);
  const addCustomItem=()=>{if(customItem.trim()&&!selectedItems.includes(customItem.trim())){setSelectedItems(prev=>[...prev,customItem.trim()]);setCustomItem("");}};
  const resetApp=()=>{setStep(0);setServiceType(null);setQuotes([]);setSelectedItems([]);setEventType(null);setGuestCount(100);setPerPlateBudget(500);setCustomerPincode("");setCustomerCoords(null);setSelectedQuote(null);setOrderPlaced(null);setQuotationRequest(null);setWhatsappSent([]);setDeliveryAddress({flat:"",building:"",street:"",landmark:"",pincode:"",city:"Kolkata",state:"West Bengal"});};

  const showLoginModal=authStage==="phone"||authStage==="otp";

  return(
    <div style={S.root}>
      {/* Bengali border pattern top */}
      <div style={S.bengaliTopBorder}/>
      <div style={S.bgPattern}/>

      {/* ── Payment Gateway Modal ─────────────────────────────────────────── */}
      {paymentModal&&<PaymentGateway amount={paymentModal.amount} purpose={paymentModal.purpose} catererName={paymentModal.catererName} onSuccess={paymentModal.onSuccess} onCancel={()=>setPaymentModal(null)}/>}

      {/* ── OTP Modal ──────────────────────────────────────────────────────── */}
      {showLoginModal&&(
        <div style={{position:"fixed",inset:0,zIndex:190,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{...S.card,...anim,maxWidth:400,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:12}}>📱</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#1f2937",marginBottom:6}}>{authStage==="phone"?"Login to Continue":"Enter OTP"}</h2>
            <p style={{fontSize:13,color:"#6b7280",marginBottom:22,lineHeight:1.5}}>{authStage==="phone"?"Verify your mobile to send quote requests":"OTP sent to +91 "+phone.slice(0,5)+" "+phone.slice(5)}</p>
            {authStage==="phone"&&<>
              <div style={{display:"flex",border:"1px solid #e5e7eb",borderRadius:10,overflow:"hidden",marginBottom:10}}>
                <div style={{padding:"12px 12px",background:"#f9fafb",color:"#6b7280",fontSize:13,fontWeight:600,borderRight:"1px solid #e5e7eb",whiteSpace:"nowrap"}}>🇮🇳 +91</div>
                <input type="tel" maxLength={10} placeholder="Mobile number" value={phone} onChange={e=>{setPhone(e.target.value.replace(/\D/g,""));setPhoneError("");}} onKeyDown={e=>e.key==="Enter"&&handleSendOtp()} style={{flex:1,padding:"12px 14px",border:"none",color:"#1f2937",fontSize:15,outline:"none"}} autoFocus/>
              </div>
              {phoneError&&<div style={{color:"#ef4444",fontSize:12,marginBottom:8}}>{phoneError}</div>}
              <button onClick={handleSendOtp} style={{...S.primaryBtn,width:"100%",marginTop:4}}>Send OTP →</button>
            </>}
            {authStage==="otp"&&<>
              <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:10}}>
                {otp.map((d,i)=><input key={i} ref={otpRefs[i]} type="tel" maxLength={1} value={d} onChange={e=>handleOtpChange(e.target.value,i)} onKeyDown={e=>handleOtpKey(e,i)} style={{width:56,height:60,textAlign:"center",fontSize:24,fontWeight:800,color:"#1f2937",background:"#f9fafb",border:`2px solid ${otpError?"#ef4444":d?"#c0392b":"#e5e7eb"}`,borderRadius:10,outline:"none"}}/>)}
              </div>
              {otpError&&<div style={{color:"#ef4444",fontSize:12,marginBottom:8}}>{otpError}</div>}
              <div style={{background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:8,padding:"7px 14px",fontSize:12,color:"#6b7280",marginBottom:12}}>🔑 Demo OTP: <strong>1234</strong></div>
              <button onClick={handleVerifyOtp} style={{...S.primaryBtn,width:"100%"}}>Verify & Continue ✓</button>
              <div style={{display:"flex",justifyContent:"center",gap:18,marginTop:12}}>
                {otpTimer>0?<span style={{fontSize:12,color:"#9ca3af"}}>Resend in {otpTimer}s</span>:<button onClick={handleResendOtp} style={{background:"none",border:"none",color:"#c0392b",fontSize:12,cursor:"pointer",fontWeight:600}}>Resend OTP</button>}
                <button onClick={()=>{setAuthStage("phone");setOtp(["","","",""]);setOtpError("");}} style={{background:"none",border:"none",color:"#9ca3af",fontSize:12,cursor:"pointer"}}>Change number</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="header-wrap" style={S.header}>
        <button onClick={()=>{navigate("landing");resetApp();}} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:46,height:46,borderRadius:12,background:"linear-gradient(135deg,#c0392b,#e74c3c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,boxShadow:"0 4px 12px rgba(192,57,43,0.3)"}}>🍛</div>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,background:"linear-gradient(135deg,#c0392b,#e74c3c)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Aayojan</div>
            <div style={{fontSize:10,color:"#9ca3af",marginTop:1}}>📍 Newtown, Kolkata</div>
          </div>
        </button>
        <div className="header-right" style={{display:"flex",alignItems:"center",gap:8}}>
          {["app","chat"].includes(view)&&<button onClick={()=>navigate("landing")} style={S.ghostBtn}>← Home</button>}
          <button onClick={()=>navigate("chat")} style={{...S.ghostBtn,borderColor:"#fca5a5",color:"#c0392b",background:"#fff5f5"}}>🤖 AI Chat</button>
          <button onClick={()=>{const d=DB.get();setDbData(d);navigate("dbview");}} style={S.ghostBtn}>🗄️ DB</button>
          {user?<div style={{display:"flex",alignItems:"center",gap:5,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#16a34a"}}>✅ {user.phone}</div>:<button onClick={()=>setAuthStage("phone")} style={{...S.primaryBtn,padding:"8px 16px",width:"auto",marginTop:0}}>Login</button>}
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          LANDING
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="landing"&&(
        <div style={{...S.page,...anim}}>
          {/* Hero */}
          <div style={{textAlign:"center",padding:"36px 0 28px",position:"relative"}}>
            {/* Bengali alpona decorative element */}
            <div style={{fontSize:28,letterSpacing:8,color:"#fca5a5",marginBottom:8,opacity:0.7}}>✦ ✦ ✦ ✦ ✦</div>
            <div style={{display:"inline-block",background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:20,padding:"5px 16px",fontSize:12,color:"#c0392b",marginBottom:16,fontWeight:600,letterSpacing:"0.05em"}}>📍 Serving Newtown, Kolkata & surrounding areas</div>
            <h1 className="hero-title" style={{fontFamily:"'Playfair Display',serif",fontSize:42,fontWeight:700,lineHeight:1.15,marginBottom:12}}>
              <span style={{color:"#1f2937"}}>Welcome to </span>
              <span style={{background:"linear-gradient(135deg,#c0392b,#e74c3c)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Aayojan !!</span>
            </h1>
            <p style={{fontSize:16,color:"#6b7280",maxWidth:500,margin:"0 auto 24px",lineHeight:1.6}}>আপনার উৎসবে সেরা খাবারের আয়োজন। Find top-rated caterers in Newtown, Rajarhat & Salt Lake.</p>
            {/* AI chatbot promo */}
            <div style={{display:"flex",alignItems:"center",gap:14,background:"linear-gradient(135deg,#fff5f5,#fffbeb)",border:"1px solid #fca5a5",borderRadius:16,padding:"16px 20px",maxWidth:580,margin:"0 auto",textAlign:"left",flexWrap:"wrap"}}>
              <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#c0392b,#e74c3c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🤖</div>
              <div style={{flex:1}}><div style={{fontWeight:800,color:"#1f2937",fontSize:15,marginBottom:2}}>Try Aayojan AI Chatbot</div><div style={{fontSize:12,color:"#6b7280"}}>Describe your event — AI builds your perfect catering order</div></div>
              <button onClick={()=>navigate("chat")} style={{...S.primaryBtn,width:"auto",marginTop:0,padding:"10px 20px",fontSize:13,flexShrink:0}}>Chat Now →</button>
            </div>
            <div style={{fontSize:20,letterSpacing:8,color:"#fca5a5",marginTop:16,opacity:0.5}}>✦ ✦ ✦ ✦ ✦</div>
          </div>

          {/* ── FOOD TASTING BANNER ─────────────────────────────────────────── */}
          <div className="tasting-banner" style={S.tastingBanner}>
            <div style={{display:"flex",gap:14,alignItems:"flex-start",flex:1}}>
              <div style={{fontSize:40,flexShrink:0}}>🍱</div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#fff",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4,opacity:0.85}}>New · Exclusive Offer</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#fff",marginBottom:6}}>Book a Food Tasting Session!</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",lineHeight:1.6,marginBottom:8}}>
                  Try before you order! Book a <strong>Bulk Food Delivery tasting</strong> — get 5–7 sample dishes delivered to your home. Taste the quality before committing to a big order.
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {["✓ 5–7 sample dishes","✓ Delivery to your home","✓ Bulk order caterers only","✓ Amount adjustable on final order"].map(f=><span key={f} style={{fontSize:12,color:"rgba(255,255,255,0.9)"}}>{f}</span>)}
                </div>
              </div>
            </div>
            <div style={{textAlign:"center",flexShrink:0}}>
              <div style={{fontSize:36,fontWeight:900,color:"#fff",fontFamily:"'Playfair Display',serif",lineHeight:1}}>₹199</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.75)",marginBottom:10}}>per tasting session</div>
              <button onClick={()=>{navigate("app");setServiceType("bulk");setStep(1);}} style={{background:"#fff",border:"none",borderRadius:10,padding:"10px 20px",color:"#c0392b",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:"0 4px 12px rgba(0,0,0,0.15)"}}>Book Tasting →</button>
            </div>
          </div>

          {/* Service type selection */}
          <div style={{marginBottom:40}}>
            <h2 style={{...S.sectionTitle,textAlign:"center",marginBottom:6}}>Choose Your Service Type</h2>
            <p style={{textAlign:"center",color:"#6b7280",fontSize:13,marginBottom:22}}>Select how you'd like your catering delivered</p>
            <div className="svc-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              {Object.values(SVC).map(svc=>(
                <button key={svc.id} onClick={()=>{setServiceType(svc.id);navigate("app");setStep(1);}}
                  style={{border:`2px solid ${svc.border}`,borderRadius:18,padding:"24px 20px",cursor:"pointer",transition:"all 0.2s",textAlign:"left",display:"flex",flexDirection:"column",gap:10,background:svc.grad,boxShadow:"0 2px 12px rgba(192,57,43,0.08)"}}>
                  <div style={{width:52,height:52,borderRadius:14,background:`rgba(${svc.accentRGB},0.12)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{svc.icon}</div>
                  <div style={{fontSize:19,fontWeight:800,fontFamily:"'Playfair Display',serif",color:svc.color}}>{svc.label}</div>
                  <div style={{fontSize:12,color:"#6b7280",lineHeight:1.4}}>{svc.tagline}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>{svc.features.map(f=><div key={f} style={{fontSize:12,color:"#374151"}}>✓ {f}</div>)}</div>
                  <div style={{background:svc.btnGrad,color:"#fff",borderRadius:10,padding:"10px 0",fontSize:13,fontWeight:700,textAlign:"center",marginTop:4}}>Book {svc.label} →</div>
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:36}}>
            {[["🍽️",DB.getCaterers().length+"+","Caterers"],["📍","10+","Pincodes"],["⭐","4.7","Avg Rating"],["🎉","500+","Events"]].map(([icon,val,lbl])=>(
              <div key={lbl} style={{background:"#fff",border:"1px solid #fde8d8",borderRadius:14,padding:"16px 12px",textAlign:"center",boxShadow:"0 1px 4px rgba(192,57,43,0.06)"}}>
                <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
                <div style={{fontSize:22,fontWeight:800,color:"#1f2937"}}>{val}</div>
                <div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.07em"}}>{lbl}</div>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div style={{marginBottom:40}}>
            <h2 style={S.sectionTitle}>How It Works</h2>
            <div className="how-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
              {[["🛎️","Pick Service","Full catering or bulk delivery"],["💬","Chat with AI","Tell our bot your needs"],["📍","Enter Pincode","5 km radius search"],["📲","48hr Quotes","WhatsApp to 5 caterers"]].map(([icon,title,desc],i)=>(
                <div key={i} style={{background:"#fff",border:"1px solid #fde8d8",borderRadius:14,padding:"18px 12px",textAlign:"center",boxShadow:"0 1px 4px rgba(192,57,43,0.05)"}}>
                  <div style={{fontSize:10,fontWeight:800,color:"#c0392b",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>{i+1}</div>
                  <div style={{fontSize:28,marginBottom:8}}>{icon}</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#1f2937",marginBottom:4}}>{title}</div>
                  <div style={{fontSize:11,color:"#9ca3af",lineHeight:1.5}}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Featured caterers */}
          <div style={{marginBottom:40}}>
            <h2 style={S.sectionTitle}>Featured Caterers</h2>
            <div className="feat-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {DB.getCaterers().slice(0,3).map(c=>(
                <div key={c.id} style={{background:"#fff",border:"1px solid #fde8d8",borderRadius:14,padding:"16px",boxShadow:"0 1px 6px rgba(192,57,43,0.07)"}}>
                  <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
                    <div style={{fontSize:26,background:"#fff5f5",borderRadius:10,width:42,height:42,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{c.logo}</div>
                    <div><div style={{fontSize:13,fontWeight:700,color:"#1f2937",marginBottom:2}}>{c.name}</div><div style={{fontSize:11,color:"#9ca3af"}}>⭐{c.rating} · 📍{PINCODE_COORDS[c.pincode]?.area}</div></div>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                    {(c.serviceTypes||["full"]).map(st=><span key={st} style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"#fff5f5",color:SVC[st].color,border:`1px solid ${SVC[st].border}`}}>{SVC[st].icon} {SVC[st].label}</span>)}
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{c.cuisineSpecialties?.slice(0,3).map(cs=><span key={cs} style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:"#f9fafb",color:"#6b7280",border:"1px solid #e5e7eb"}}>{cs}</span>)}</div>
                  <div style={{fontSize:13,color:"#c0392b",fontWeight:700,marginTop:8}}>{c.priceRange}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Caterer CTA */}
          <div className="caterer-cta" style={{background:"linear-gradient(135deg,#c0392b,#e74c3c)",borderRadius:18,padding:"32px 36px",display:"flex",gap:24,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#fff",marginBottom:8}}>Are you a caterer? 👨‍🍳</div>
              <div style={{fontSize:14,color:"rgba(255,255,255,0.85)",marginBottom:12,lineHeight:1.6}}>Join Aayojan and receive WhatsApp quotation requests from customers in Newtown.</div>
              {["✓ Free registration","✓ WhatsApp requests directly","✓ Full Service or Bulk Delivery"].map(p=><div key={p} style={{fontSize:13,color:"rgba(255,255,255,0.9)",marginBottom:3}}>{p}</div>)}
            </div>
            <button onClick={()=>navigate("register")} style={{background:"#fff",border:"none",borderRadius:12,padding:"14px 28px",color:"#c0392b",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:"0 4px 16px rgba(0,0,0,0.15)",flexShrink:0}}>Register Your Business →</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          AI CHAT
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="chat"&&(
        <div style={{...S.page,...anim}}>
          <div style={{maxWidth:700,margin:"0 auto"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <h2 style={{...S.sectionTitle,marginBottom:4}}>🤖 Aayojan AI Chatbot</h2>
              <p style={{color:"#6b7280",fontSize:13}}>Describe your event in natural language — AI creates your catering order</p>
            </div>
            {chatOrderConfirmed?(
              <div style={{...S.card,textAlign:"center"}}>
                <div style={{fontSize:60,marginBottom:12}}>🎉</div>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#1f2937",marginBottom:6}}>Chat Order Placed!</h2>
                <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:14,padding:"18px",marginBottom:16}}>
                  <div style={{fontSize:20,fontWeight:900,fontFamily:"monospace",color:"#16a34a",marginBottom:10}}>{chatOrderConfirmed.id}</div>
                  {[["Service",SVC[chatOrderConfirmed.serviceType]?.label||chatOrderConfirmed.serviceType],["Event",chatOrderConfirmed.eventType],["Guests",chatOrderConfirmed.guestCount],["Budget",`₹${chatOrderConfirmed.perPlateBudget}/plate`]].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{color:"#6b7280"}}>{l}</span><span style={{color:"#1f2937",fontWeight:600,textTransform:"capitalize"}}>{v}</span></div>
                  ))}
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>{setChatOrderConfirmed(null);navigate("chat");}} style={S.secondaryBtn}>New Chat</button>
                  <button onClick={()=>{const d=DB.get();setDbData(d);navigate("dbview");setDbTab("chatOrders");}} style={{...S.primaryBtn,marginTop:0,flex:1}}>View in DB 🗄️</button>
                </div>
              </div>
            ):(
              <AayojanChatbot user={user} onOrderCreated={order=>{setChatOrderConfirmed(order);}} onLoginRequired={()=>setAuthStage("phone")}/>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          REGISTRATION
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="register"&&(
        <div style={{...S.page,...anim}}>
          <div style={{maxWidth:700,margin:"0 auto"}}>
            {!regSuccess?<>
              <div style={{textAlign:"center",marginBottom:28}}>
                <span style={{fontSize:44}}>👨‍🍳</span>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"#1f2937",marginTop:10,marginBottom:6}}>Register Your Catering Business</h2>
                <p style={{fontSize:13,color:"#6b7280"}}>Join Newtown's fastest-growing caterer network</p>
              </div>
              <div style={{...S.card,padding:"28px 32px"}}>
                <div className="form-grid" style={S.formGrid}>
                  {[["Business Name *","name","e.g. Kolkata Grand Feast"],["Owner / Manager *","ownerName","Full name"]].map(([lbl,key,ph])=>(
                    <div key={key} style={S.fieldWrap}><label style={S.fieldLabel}>{lbl}</label>
                      <input style={{...S.inp2,borderColor:regErrors[key]?"#ef4444":"#e5e7eb"}} value={regForm[key]} onChange={e=>setRegForm({...regForm,[key]:e.target.value})} placeholder={ph}/>
                      {regErrors[key]&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors[key]}</div>}
                    </div>
                  ))}
                  <div style={S.fieldWrap}><label style={S.fieldLabel}>WhatsApp Number *</label>
                    <div style={{display:"flex",border:`1px solid ${regErrors.phone?"#ef4444":"#e5e7eb"}`,borderRadius:9,overflow:"hidden"}}>
                      <div style={{padding:"11px 10px",background:"#f9fafb",color:"#6b7280",fontSize:12,borderRight:"1px solid #e5e7eb",whiteSpace:"nowrap"}}>+91</div>
                      <input style={{...S.inp2,border:"none",borderRadius:0,flex:1}} type="tel" maxLength={10} value={regForm.phone} onChange={e=>setRegForm({...regForm,phone:e.target.value.replace(/\D/g,"")})} placeholder="10-digit WhatsApp number"/>
                    </div>
                    {regErrors.phone&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors.phone}</div>}
                    <div style={{fontSize:11,color:"#9ca3af",marginTop:3}}>📲 Hidden from customers. Quote requests via WhatsApp.</div>
                  </div>
                  <div style={S.fieldWrap}><label style={S.fieldLabel}>Email *</label>
                    <input style={{...S.inp2,borderColor:regErrors.email?"#ef4444":"#e5e7eb"}} type="email" value={regForm.email} onChange={e=>setRegForm({...regForm,email:e.target.value})} placeholder="business@email.com"/>
                    {regErrors.email&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors.email}</div>}
                  </div>
                  <div style={{...S.fieldWrap,gridColumn:"1 / -1"}}><label style={S.fieldLabel}>Full Address *</label>
                    <input style={{...S.inp2,borderColor:regErrors.address?"#ef4444":"#e5e7eb"}} value={regForm.address} onChange={e=>setRegForm({...regForm,address:e.target.value})} placeholder="Plot/Flat No., Block/Area, Street"/>
                    {regErrors.address&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors.address}</div>}
                  </div>
                  <div style={S.fieldWrap}><label style={S.fieldLabel}>Pincode *</label>
                    <input style={{...S.inp2,borderColor:regErrors.pincode?"#ef4444":"#e5e7eb"}} maxLength={6} value={regForm.pincode} onChange={e=>setRegForm({...regForm,pincode:e.target.value.replace(/\D/g,"")})} placeholder="e.g. 700156"/>
                    {regErrors.pincode&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors.pincode}</div>}
                    <div style={{fontSize:10,color:"#9ca3af",marginTop:2}}>700156, 700157, 700135, 700161, 700136, 700059, 700091, 700105, 700107, 700160</div>
                  </div>
                  <div style={S.fieldWrap}><label style={S.fieldLabel}>Price Range</label>
                    <div style={{display:"flex",gap:6}}>
                      {["₹","₹₹","₹₹₹","₹₹₹₹"].map(p=><button key={p} onClick={()=>setRegForm({...regForm,priceRange:p})} style={{padding:"7px 12px",borderRadius:7,border:"1px solid",borderColor:regForm.priceRange===p?"#c0392b":"#e5e7eb",background:regForm.priceRange===p?"#c0392b":"#fff",color:regForm.priceRange===p?"#fff":"#6b7280",fontSize:12,fontWeight:600,cursor:"pointer"}}>{p}</button>)}
                    </div>
                  </div>
                  <div style={{...S.fieldWrap,gridColumn:"1 / -1"}}><label style={S.fieldLabel}>Service Types *</label>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      {Object.values(SVC).map(svc=>(
                        <button key={svc.id} onClick={()=>setRegForm(prev=>({...prev,serviceTypes:prev.serviceTypes.includes(svc.id)?prev.serviceTypes.filter(x=>x!==svc.id):[...prev.serviceTypes,svc.id]}))
                        } style={{display:"flex",alignItems:"center",gap:10,padding:"12px",border:`2px solid ${regForm.serviceTypes.includes(svc.id)?svc.color:svc.border}`,borderRadius:10,cursor:"pointer",background:regForm.serviceTypes.includes(svc.id)?svc.grad:"#fff"}}>
                          <span style={{fontSize:20}}>{svc.icon}</span>
                          <div style={{textAlign:"left",flex:1}}><div style={{fontSize:13,fontWeight:700,color:regForm.serviceTypes.includes(svc.id)?svc.color:"#374151"}}>{svc.label}</div><div style={{fontSize:10,color:"#9ca3af"}}>{svc.tagline}</div></div>
                          {regForm.serviceTypes.includes(svc.id)&&<span style={{color:svc.color,fontSize:14}}>✓</span>}
                        </button>
                      ))}
                    </div>
                    {regErrors.serviceTypes&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors.serviceTypes}</div>}
                  </div>
                  <div style={{...S.fieldWrap,gridColumn:"1 / -1"}}><label style={S.fieldLabel}>Cuisine Specialties *</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                      {ALL_CUISINES.map(c=><button key={c} onClick={()=>setRegForm(prev=>({...prev,cuisineSpecialties:prev.cuisineSpecialties.includes(c)?prev.cuisineSpecialties.filter(x=>x!==c):[...prev.cuisineSpecialties,c]}))} style={{padding:"5px 12px",borderRadius:16,border:"1px solid",borderColor:regForm.cuisineSpecialties.includes(c)?"#c0392b":"#e5e7eb",background:regForm.cuisineSpecialties.includes(c)?"#fff5f5":"#fff",color:regForm.cuisineSpecialties.includes(c)?"#c0392b":"#6b7280",fontSize:12,cursor:"pointer"}}>
                        {regForm.cuisineSpecialties.includes(c)&&"✓ "}{c}
                      </button>)}
                    </div>
                    {regErrors.cuisineSpecialties&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors.cuisineSpecialties}</div>}
                  </div>
                  <div style={{...S.fieldWrap,gridColumn:"1 / -1"}}><label style={S.fieldLabel}>Event Specialties *</label>
                    <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                      {["Wedding","Party","Corporate","Religious"].map(sp=><button key={sp} onClick={()=>setRegForm(prev=>({...prev,specialty:prev.specialty.includes(sp)?prev.specialty.filter(s=>s!==sp):[...prev.specialty,sp]}))} style={{padding:"6px 14px",borderRadius:16,border:"1px solid",borderColor:regForm.specialty.includes(sp)?"#c0392b":"#e5e7eb",background:regForm.specialty.includes(sp)?"#c0392b":"#fff",color:regForm.specialty.includes(sp)?"#fff":"#6b7280",fontSize:12,fontWeight:600,cursor:"pointer"}}>{sp}</button>)}
                    </div>
                    {regErrors.specialty&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors.specialty}</div>}
                  </div>
                </div>
                <div style={{background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:10,padding:"12px 16px",fontSize:12,color:"#6b7280",lineHeight:1.6,marginTop:20}}>🔒 Your phone number is never shown to customers. Aayojan acts as the secure intermediary.</div>
                <div style={{display:"flex",gap:10,marginTop:18}}>
                  <button onClick={()=>navigate("landing")} style={S.secondaryBtn}>← Back</button>
                  <button onClick={submitReg} style={{...S.primaryBtn,flex:1,marginTop:0}}>Register Business 🚀</button>
                </div>
              </div>
            </>:(
              <div style={{...S.card,textAlign:"center",padding:"32px"}}>
                <div style={{fontSize:56}}>🎉</div>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#1f2937",margin:"10px 0 6px"}}>You're Registered!</h2>
                <p style={{color:"#6b7280",marginBottom:20}}>Welcome to Aayojan, <strong style={{color:"#c0392b"}}>{regForm.name}</strong></p>
                <div style={{background:"#fff5f5",border:"1px solid #fde8d8",borderRadius:12,padding:"16px",textAlign:"left",marginBottom:20}}>
                  {[["📍 Area",PINCODE_COORDS[regForm.pincode]?.area||regForm.pincode],["🛎️ Services",regForm.serviceTypes.map(t=>SVC[t].label).join(", ")],["🍽️ Cuisines",regForm.cuisineSpecialties.join(", ")],["📲 WhatsApp",`+91 ${String(regForm.phone).slice(0,5)}••••• (hidden)`]].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:8,color:"#6b7280"}}><span>{l}</span><span style={{textAlign:"right",maxWidth:"60%",color:"#374151"}}>{v}</span></div>
                  ))}
                </div>
                <div style={{display:"flex",gap:10}}>
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
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#1f2937",marginBottom:4}}>🗄️ Database Viewer</h2>
            <p style={{color:"#9ca3af",fontSize:13,marginBottom:18}}>Live in-memory records</p>
            <div style={{display:"flex",gap:0,borderBottom:"2px solid #fde8d8",marginBottom:20,flexWrap:"wrap"}}>
              {[["caterers",`🍽️ Caterers (${dbData.caterers.length})`],["customers",`👥 Customers (${dbData.customers.length})`],["quotationRequests",`📲 Quotations (${dbData.quotationRequests?.length||0})`],["orders",`📦 Orders (${dbData.orders.length})`],["chatOrders",`🤖 Chat (${dbData.chatOrders?.length||0})`],["payments",`💳 Payments (${dbData.payments?.length||0})`]].map(([t,lbl])=>(
                <button key={t} onClick={()=>setDbTab(t)} style={{padding:"9px 14px",background:"none",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",borderBottom:dbTab===t?"2px solid #c0392b":"2px solid transparent",color:dbTab===t?"#c0392b":"#6b7280",marginBottom:"-2px"}}>{lbl}</button>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {dbTab==="caterers"&&dbData.caterers.map(c=>(
                <div key={c.id} style={{background:"#fff",border:"1px solid #fde8d8",borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 3px rgba(192,57,43,0.05)"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:5}}>
                    <span style={{fontSize:18}}>{c.logo}</span><span style={{fontWeight:700,color:"#1f2937"}}>{c.name}</span>
                    <span style={{fontSize:12,color:"#9ca3af"}}>📍{c.pincode}</span><span style={{fontSize:12,color:"#9ca3af"}}>📞{String(c.phone).slice(0,5)}•••••</span>
                    <span style={{fontSize:12,color:"#9ca3af"}}>⭐{c.rating}</span><span style={{fontSize:12,color:c.active?"#16a34a":"#ef4444"}}>{c.active?"● Active":"○ Inactive"}</span>
                  </div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {(c.serviceTypes||["full"]).map(st=><span key={st} style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:"#fff5f5",color:SVC[st]?.color,border:`1px solid ${SVC[st]?.border}`}}>{SVC[st]?.icon} {SVC[st]?.label}</span>)}
                    {c.cuisineSpecialties?.map(cs=><span key={cs} style={{fontSize:10,color:"#9ca3af"}}>{cs}</span>)}
                  </div>
                </div>
              ))}
              {dbTab==="customers"&&(dbData.customers.length===0?<div style={{color:"#9ca3af",padding:"20px",textAlign:"center"}}>No customers yet.</div>:dbData.customers.map(c=>(
                <div key={c.id} style={{background:"#fff",border:"1px solid #fde8d8",borderRadius:10,padding:"12px 14px",display:"flex",gap:12,alignItems:"center"}}>
                  <span>👤</span><span style={{fontWeight:700,color:"#1f2937"}}>{c.phone}</span><span style={{fontSize:12,color:"#9ca3af"}}>{c.registeredAt?.split("T")[0]}</span>
                </div>
              )))}
              {dbTab==="quotationRequests"&&((dbData.quotationRequests||[]).length===0?<div style={{color:"#9ca3af",padding:"20px",textAlign:"center"}}>No quotation requests yet.</div>:(dbData.quotationRequests||[]).map(qr=>(
                <div key={qr.id} style={{background:"#fff",border:"1px solid #fde8d8",borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:5}}>
                    <span style={{fontWeight:800,color:"#c0392b",fontSize:12}}>{qr.id}</span>
                    <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:"#fff5f5",color:SVC[qr.serviceType]?.color,border:`1px solid ${SVC[qr.serviceType]?.border}`}}>{SVC[qr.serviceType]?.icon}</span>
                    <span style={{fontSize:12,color:"#9ca3af"}}>🎉{qr.eventType}</span><span style={{fontSize:12,color:"#9ca3af"}}>👥{qr.guestCount}</span><span style={{fontSize:12,color:"#16a34a"}}>₹{qr.perPlateBudget}/plate</span>
                  </div>
                  <div style={{fontSize:11,color:"#9ca3af"}}>⏰ Expires: {new Date(qr.expiresAt).toLocaleString("en-IN")}</div>
                </div>
              )))}
              {dbTab==="orders"&&(dbData.orders.length===0?<div style={{color:"#9ca3af",padding:"20px",textAlign:"center"}}>No orders yet.</div>:dbData.orders.map(o=>(
                <div key={o.id} style={{background:"#fff",border:"1px solid #fde8d8",borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:4}}>
                    <span style={{fontWeight:800,color:"#c0392b"}}>{o.id}</span><span style={{fontSize:12,color:"#6b7280"}}>{o.catererName}</span>
                    <span style={{fontSize:12,color:"#9ca3af"}}>👥{o.guestCount}</span><span style={{fontSize:12,color:"#9ca3af"}}>₹{o.perPlateActual}/plate</span><span style={{fontSize:12,color:"#16a34a"}}>₹{o.totalPrice?.toLocaleString()}</span>
                  </div>
                  <div style={{fontSize:11,color:"#9ca3af"}}>📍 {o.deliveryAddress}</div>
                </div>
              )))}
              {dbTab==="chatOrders"&&((dbData.chatOrders||[]).length===0?<div style={{color:"#9ca3af",padding:"20px",textAlign:"center"}}>No chat orders yet.</div>:(dbData.chatOrders||[]).map(o=>(
                <div key={o.id} style={{background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    <span style={{fontWeight:800,color:"#c0392b"}}>{o.id}</span><span style={{fontSize:11,padding:"2px 7px",borderRadius:8,background:"#fff5f5",color:"#c0392b",border:"1px solid #fca5a5"}}>🤖 Chatbot</span>
                    <span style={{fontSize:12,color:"#6b7280",textTransform:"capitalize"}}>{o.eventType}</span><span style={{fontSize:12,color:"#9ca3af"}}>👥{o.guestCount}</span><span style={{fontSize:12,color:"#16a34a"}}>₹{o.perPlateBudget}/plate</span>
                  </div>
                </div>
              )))}
              {dbTab==="payments"&&((dbData.payments||[]).length===0?<div style={{color:"#9ca3af",padding:"20px",textAlign:"center"}}>No payments yet.</div>:(dbData.payments||[]).map(p=>(
                <div key={p.id} style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"12px 14px",display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{fontWeight:800,color:"#16a34a",fontSize:13}}>{p.id}</span>
                  <span style={{fontSize:12,padding:"2px 8px",borderRadius:8,background:"#fff",border:"1px solid #bbf7d0",color:p.type==="phone_unlock"?"#c0392b":"#ea580c"}}>{p.type==="phone_unlock"?"📞 Phone Unlock":"🍱 Food Tasting"}</span>
                  <span style={{fontSize:12,color:"#6b7280"}}>{p.catererName}</span>
                  <span style={{fontSize:14,fontWeight:800,color:"#16a34a"}}>₹{p.amount}</span>
                  <span style={{fontSize:12,color:"#16a34a"}}>✅ {p.status}</span>
                  <span style={{fontSize:11,color:"#9ca3af"}}>{new Date(p.paidAt).toLocaleString("en-IN")}</span>
                </div>
              )))}
            </div>
            <button onClick={()=>navigate("landing")} style={{...S.secondaryBtn,marginTop:20}}>← Back to Home</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          APP FLOW
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="app"&&(
        <div style={{...S.page,...anim}}>
          {step<6&&<>
            {stCfg&&<div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,background:stCfg.grad,border:`1px solid ${stCfg.border}`,borderRadius:20,padding:"5px 14px"}}>
                <span>{stCfg.icon}</span><span style={{fontSize:12,fontWeight:700,color:stCfg.color}}>{stCfg.label}</span>
                <button onClick={resetApp} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:10}}>Change ×</button>
              </div>
            </div>}
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"12px 16px 4px"}}>
              {STEPS.map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",transition:"all 0.3s",zIndex:1,background:i<=step?accent:"#d1d5db",boxShadow:i===step?`0 0 0 3px ${accent}33`:"none",transform:i===step?"scale(1.15)":"scale(1)"}}>{i<step?"✓":i+1}</div>
                  {i<STEPS.length-1&&<div style={{width:32,height:2,background:i<step?accent:"#e5e7eb",transition:"background 0.3s"}}/>}
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"center",padding:"3px 16px 16px"}}>
              {STEPS.map((s,i)=><span key={i} style={{width:68,textAlign:"center",fontSize:9,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase",color:i===step?accent:"#9ca3af"}}>{s}</span>)}
            </div>
          </>}

          <div style={S.card}>
            {/* Step 0: Service */}
            {step===0&&<div>
              <h2 style={S.cardTitle}>Choose Your Service</h2>
              <p style={{fontSize:14,color:"#6b7280",marginBottom:20}}>How would you like your catering?</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {Object.values(SVC).map(svc=>(
                  <button key={svc.id} onClick={()=>{setServiceType(svc.id);setStep(1);}} style={{border:`2px solid ${svc.border}`,borderRadius:16,padding:"22px 18px",cursor:"pointer",background:svc.grad,textAlign:"left",display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{width:50,height:50,borderRadius:12,background:`rgba(${svc.accentRGB},0.12)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{svc.icon}</div>
                    <div style={{fontSize:18,fontWeight:800,fontFamily:"'Playfair Display',serif",color:svc.color}}>{svc.label}</div>
                    <div style={{fontSize:12,color:"#6b7280"}}>{svc.tagline}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>{svc.features.map(f=><div key={f} style={{fontSize:11,color:"#374151"}}>✓ {f}</div>)}</div>
                  </button>
                ))}
              </div>
            </div>}

            {/* Step 1: Pincode */}
            {step===1&&<div>
              <h2 style={S.cardTitle}>Enter Your Pincode</h2>
              <p style={{fontSize:14,color:"#6b7280",marginBottom:18}}>We'll show <span style={{color:accent,fontWeight:700}}>{stCfg?.label}</span> caterers within <strong style={{color:"#16a34a"}}>5 km</strong>.</p>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                <span style={{fontSize:30}}>📍</span>
                <input style={{flex:1,background:"#fff",border:`2px solid ${pincodeError?"#ef4444":customerPincode?accent:"#e5e7eb"}`,borderRadius:12,padding:"16px 20px",color:"#1f2937",fontSize:26,fontWeight:800,outline:"none",letterSpacing:"0.15em",textAlign:"center"}}
                  type="tel" maxLength={6} value={customerPincode} onChange={e=>{setCustomerPincode(e.target.value.replace(/\D/g,""));setPincodeError("");}} onKeyDown={e=>e.key==="Enter"&&handlePincodeNext()} placeholder="700156" autoFocus/>
              </div>
              {pincodeError&&<div style={{color:"#ef4444",fontSize:12,textAlign:"center",marginBottom:8}}>{pincodeError}</div>}
              <div style={{marginTop:14,marginBottom:12}}>
                <div style={{fontSize:11,color:"#9ca3af",marginBottom:7,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em"}}>Supported pincodes:</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {Object.entries(PINCODE_COORDS).map(([pin])=><button key={pin} onClick={()=>{setCustomerPincode(pin);setPincodeError("");}} style={{padding:"4px 10px",borderRadius:14,border:"1px solid",borderColor:customerPincode===pin?accent:"#e5e7eb",background:customerPincode===pin?accent:"#fff",color:customerPincode===pin?"#fff":"#6b7280",fontSize:12,cursor:"pointer"}}>{pin}</button>)}
                </div>
              </div>
              {customerPincode&&PINCODE_COORDS[customerPincode]&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"8px 14px",fontSize:13,color:"#16a34a",marginBottom:12}}>✅ <strong>{PINCODE_COORDS[customerPincode].area}</strong></div>}
              <button onClick={handlePincodeNext} disabled={customerPincode.length!==6} style={{...S.primaryBtn,background:accentGrad,opacity:customerPincode.length===6?1:0.4}}>Find Caterers Near Me →</button>
            </div>}

            {/* Step 2: Event */}
            {step===2&&<div>
              <h2 style={S.cardTitle}>What's the occasion?</h2>
              <p style={{fontSize:14,color:"#6b7280",marginBottom:18}}>Near {customerCoords?.area} · {stCfg?.label}</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
                {EVENT_TYPES.map(e=><button key={e.id} onClick={()=>setEventType(e.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7,padding:"18px 12px",border:`2px solid ${eventType===e.id?accent:"#e5e7eb"}`,borderRadius:12,cursor:"pointer",background:eventType===e.id?"#fff5f5":"#fff",transform:eventType===e.id?"translateY(-2px)":"none",transition:"all 0.2s"}}>
                  <span style={{fontSize:32}}>{e.icon}</span><span style={{fontSize:14,fontWeight:700,color:"#1f2937"}}>{e.label}</span><span style={{fontSize:11,color:"#9ca3af",textAlign:"center"}}>{e.desc}</span>
                </button>)}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setStep(1)} style={S.secondaryBtn}>← Back</button>
                <button onClick={()=>setStep(3)} disabled={!eventType} style={{...S.primaryBtn,marginTop:0,flex:1,background:accentGrad,opacity:eventType?1:0.4}}>Continue →</button>
              </div>
            </div>}

            {/* Step 3: Guests + Budget */}
            {step===3&&<div>
              <h2 style={S.cardTitle}>Guests & Budget</h2>
              <p style={{fontSize:14,color:"#6b7280",marginBottom:18}}>Set headcount and per-{serviceType==="full"?"plate":"portion"} budget</p>
              <div style={{marginBottom:24}}>
                <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>👥 Number of Guests</div>
                {serviceType==="full"&&guestCount<30&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#ef4444",marginBottom:8}}>⚠️ Full Catering requires minimum 30 guests</div>}
                <div style={{textAlign:"center",marginBottom:14}}>
                  <span style={{fontSize:60,fontWeight:900,color:accent,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{guestCount}</span>
                  <div style={{fontSize:13,color:"#9ca3af",marginTop:3}}>Guests{serviceType==="full"?" (min. 30)":""}</div>
                </div>
                <input type="range" min={serviceType==="full"?30:1} max={1000} step={serviceType==="full"?10:1} value={guestCount} onChange={e=>setGuestCount(Number(e.target.value))} style={{width:"100%",accentColor:accent,marginBottom:6}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#9ca3af",marginBottom:14}}><span>{serviceType==="full"?"30":"1"}</span><span>1000+</span></div>
                <div style={{display:"flex",gap:7,justifyContent:"center"}}>
                  {(serviceType==="full"?[50,100,200,300,500]:[10,25,50,100,200]).map(n=><button key={n} onClick={()=>setGuestCount(n)} style={{padding:"6px 14px",borderRadius:8,border:"1px solid",borderColor:guestCount===n?accent:"#e5e7eb",background:guestCount===n?accent:"#fff",color:guestCount===n?"#fff":"#374151",fontSize:12,fontWeight:600,cursor:"pointer"}}>{n}</button>)}
                </div>
              </div>
              <div style={{borderTop:"1px solid #fde8d8",paddingTop:20}}>
                <div style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>💰 Per-{serviceType==="full"?"Plate":"Portion"} Budget</div>
                <BudgetSlider svcType={serviceType} value={perPlateBudget} onChange={setPerPlateBudget}/>
              </div>
              <div style={{display:"flex",gap:10,marginTop:20}}>
                <button onClick={()=>setStep(2)} style={S.secondaryBtn}>← Back</button>
                <button onClick={()=>setStep(4)} disabled={serviceType==="full"&&guestCount<30} style={{...S.primaryBtn,marginTop:0,flex:1,background:accentGrad,opacity:(serviceType==="full"&&guestCount<30)?0.4:1}}>Continue to Menu →</button>
              </div>
            </div>}

            {/* Step 4: Menu */}
            {step===4&&<div>
              <h2 style={S.cardTitle}>Build Your Menu</h2>
              <p style={{fontSize:14,color:"#6b7280",marginBottom:18}}>{selectedItems.length} selected · Budget: <span style={{color:accent,fontWeight:700}}>₹{perPlateBudget}/{serviceType==="full"?"plate":"portion"}</span></p>
              {Object.entries(MENU_ITEMS).map(([cat,items])=>(
                <div key={cat} style={{marginBottom:18}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:accent,marginBottom:8,paddingBottom:5,borderBottom:`1px solid #fde8d8`}}>{cat}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {items.map(item=><button key={item} onClick={()=>toggleItem(item)} style={{padding:"5px 12px",borderRadius:16,fontSize:12,fontWeight:500,cursor:"pointer",border:"1px solid",transition:"all 0.15s",background:selectedItems.includes(item)?accent:"#fff",color:selectedItems.includes(item)?"#fff":"#374151",borderColor:selectedItems.includes(item)?accent:"#e5e7eb"}}>{selectedItems.includes(item)&&"✓ "}{item}</button>)}
                  </div>
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:14,marginBottom:12}}>
                <input value={customItem} onChange={e=>setCustomItem(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCustomItem()} placeholder="Add custom dish..." style={{flex:1,padding:"10px 14px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:9,color:"#1f2937",fontSize:13,outline:"none"}}/>
                <button onClick={addCustomItem} style={{padding:"10px 16px",background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:9,color:accent,fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Add</button>
              </div>
              {selectedItems.length>0&&<div style={{background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:10,padding:"12px",marginTop:10}}>
                <div style={{fontSize:11,fontWeight:700,color:accent,marginBottom:7,textTransform:"uppercase",letterSpacing:"0.08em"}}>Selected ({selectedItems.length})</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{selectedItems.map(item=><span key={item} onClick={()=>toggleItem(item)} style={{padding:"4px 10px",borderRadius:16,fontSize:12,cursor:"pointer",background:"#fff",color:accent,border:`1px solid ${accent}`}}>{item} ×</span>)}</div>
              </div>}
              <div style={{display:"flex",gap:12,alignItems:"flex-start",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"14px",marginTop:14}}>
                <span style={{fontSize:24}}>⏳</span>
                <div><div style={{fontWeight:700,color:"#1f2937",marginBottom:2}}>Quotation in 48 Hours</div><div style={{fontSize:12,color:"#6b7280",lineHeight:1.5}}>WhatsApp sent to <strong style={{color:accent}}>up to 5 caterers</strong> near you with budget <strong style={{color:accent}}>₹{perPlateBudget}/{serviceType==="full"?"plate":"portion"}</strong>.</div></div>
              </div>
              {authStage!=="verified"&&selectedItems.length>0&&<div style={{background:"#fff7ed",border:"1px solid #fdba74",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#6b7280",marginTop:10}}>🔒 Login required to send quote requests.</div>}
              <div style={{display:"flex",gap:10,marginTop:18}}>
                <button onClick={()=>setStep(3)} style={S.secondaryBtn}>← Back</button>
                <button onClick={generateQuotes} disabled={selectedItems.length===0} style={{...S.primaryBtn,marginTop:0,flex:1,background:accentGrad,opacity:selectedItems.length>0?1:0.4}}>
                  {loading?"Sending...":authStage==="verified"?"Send Quotation Request 📲":"Login & Send Request 🔒"}
                </button>
              </div>
              {loading&&<div style={{marginTop:14,height:3,background:"#fde8d8",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",background:accentGrad,animation:"loadSlide 1.6s ease forwards"}}/></div>}
            </div>}

            {/* Step 5: Quotes */}
            {step===5&&<div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div><h2 style={S.cardTitle}>Quotation Sent! ✅</h2><p style={{fontSize:13,color:"#6b7280",marginBottom:18}}>{quotes.length} caterers contacted · {stCfg?.label}</p></div>
                {user&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"5px 10px",fontSize:11,color:"#16a34a"}}>✅ {user.phone}</div>}
              </div>

              {/* 48hr banner */}
              {quotationRequest&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(135deg,#fff5f5,#fffbeb)",border:"1px solid #fca5a5",borderRadius:12,padding:"14px 18px",marginBottom:16,gap:12}}>
                <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <span style={{fontSize:26}}>⏰</span>
                  <div><div style={{fontWeight:800,color:"#1f2937",fontSize:14}}>Awaiting Caterer Responses</div><div style={{fontSize:12,color:"#6b7280",marginTop:2}}>Request: <span style={{color:accent,fontFamily:"monospace"}}>{quotationRequest.id}</span></div><div style={{fontSize:11,color:"#9ca3af",marginTop:1}}>Expires: {new Date(quotationRequest.expiresAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</div></div>
                </div>
                <div style={{textAlign:"center",flexShrink:0}}><div style={{fontSize:40,fontWeight:900,color:accent,fontFamily:"'Playfair Display',serif",lineHeight:1}}>48</div><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.07em"}}>Hours</div></div>
              </div>}

              {/* WA log */}
              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:"12px 16px",marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,color:"#16a34a",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>📲 WhatsApp Dispatch Log</div>
                {whatsappSent.map((w,i)=>{const cat=quotes.find(q=>q.id===w.catererId);const waUrl=cat?`https://wa.me/91${cat.phone}?text=${buildWAMsg(cat,quotationRequest)}`:"#";return(
                  <div key={w.catererId} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid #dcfce7"}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:"#dcfce7",color:"#16a34a",fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                    <div style={{flex:1}}><div style={{fontWeight:700,color:"#1f2937",fontSize:12}}>{w.catererName}</div><div style={{fontSize:10,color:"#9ca3af"}}>📞 {w.maskedPhone}</div></div>
                    <span style={{fontSize:10,color:"#16a34a",background:"#dcfce7",border:"1px solid #bbf7d0",borderRadius:5,padding:"2px 7px"}}>{w.status}</span>
                    <a href={waUrl} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#fff",background:"#25d366",borderRadius:5,padding:"4px 10px",fontWeight:700}}>Open WA ↗</a>
                  </div>
                );})}
              </div>

              {/* Summary */}
              <div style={{display:"flex",justifyContent:"space-around",background:"#fff5f5",border:"1px solid #fde8d8",borderRadius:10,padding:"10px",marginBottom:12}}>
                {[["📍",customerPincode,"Pincode"],["👥",guestCount,"Guests"],[`💰`,`₹${perPlateBudget}`,serviceType==="full"?"Per Plate":"Per Portion"],["🍽️",selectedItems.length,"Dishes"]].map(([icon,val,lbl])=>(
                  <div key={lbl} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                    <span style={{fontSize:14}}>{icon}</span><span style={{fontSize:14,fontWeight:800,color:accent}}>{val}</span><span style={{fontSize:9,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.06em"}}>{lbl}</span>
                  </div>
                ))}
              </div>

              <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"9px 12px",fontSize:12,color:"#6b7280",marginBottom:14}}>
                Sorted by per-plate price. <span style={{color:"#16a34a"}}>🟢 Within budget</span> · <span style={{color:"#ef4444"}}>🔴 Over budget</span> · Beyond 5 km: <strong style={{color:accent}}>+₹{KM_RATE}/km</strong>
              </div>

              {quotes.map(q=>(
                <div key={q.id} style={{background:"#fff",border:`1.5px solid ${selectedQuote?.id===q.id?"#16a34a":expandedCaterer===q.id?accent:"#fde8d8"}`,borderRadius:14,padding:"16px 18px",marginBottom:12,boxShadow:"0 2px 8px rgba(192,57,43,0.06)"}}>
                  {/* Budget & distance badges */}
                  <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,padding:"3px 10px",borderRadius:14,fontWeight:700,background:q.withinBudget?"#f0fdf4":"#fef2f2",color:q.withinBudget?"#16a34a":"#ef4444",border:`1px solid ${q.withinBudget?"#bbf7d0":"#fecaca"}`}}>
                      {q.withinBudget?`✓ Within budget · ₹${q.perPlateActual}/plate`:`⚠ Over budget · ₹${q.perPlateActual}/plate`}
                    </span>
                    <span style={{fontSize:11,padding:"3px 10px",borderRadius:14,fontWeight:600,background:q.distanceKm<=5?"#f0fdf4":"#fff7ed",color:q.distanceKm<=5?"#16a34a":"#ea580c",border:`1px solid ${q.distanceKm<=5?"#bbf7d0":"#fdba74"}`}}>
                      📍 {q.distanceKm} km {q.distanceKm<=5?"✓ Free zone":`+₹${q.travelSurcharge}`}
                    </span>
                  </div>

                  <div style={{display:"flex",gap:12,marginBottom:10}}>
                    <div style={{width:46,height:46,fontSize:22,background:"#fff5f5",borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{q.logo}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,fontWeight:700,color:"#1f2937",marginBottom:2}}>{q.name}</div>
                      <div style={{fontSize:11,color:"#9ca3af",marginBottom:3}}>⭐{q.rating} · 📍{PINCODE_COORDS[q.pincode]?.area} · ⏱{q.turnaround}</div>

                      {/* Phone: locked or unlocked */}
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,padding:"5px 10px",background:unlockedPhones[q.id]?"#f0fdf4":"#f9fafb",border:`1px solid ${unlockedPhones[q.id]?"#bbf7d0":"#e5e7eb"}`,borderRadius:8}}>
                        {unlockedPhones[q.id]?(
                          <span style={{fontSize:13,fontWeight:700,color:"#16a34a"}}>📞 +91 {unlockedPhones[q.id]}</span>
                        ):(
                          <>
                            <span style={{fontSize:12,color:"#9ca3af",fontFamily:"monospace"}}>📞 {String(q.phone).slice(0,5)}•••••</span>
                            <button onClick={()=>handleUnlockPhone(q)} style={{marginLeft:"auto",background:"linear-gradient(135deg,#c0392b,#e74c3c)",border:"none",borderRadius:6,padding:"4px 12px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                              🔓 Unlock ₹{PHONE_UNLOCK_FEE}
                            </button>
                          </>
                        )}
                      </div>

                      {q.cuisineSpecialties?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:5}}>{q.cuisineSpecialties.map(cs=><span key={cs} style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:"#fff5f5",color:accent,border:"1px solid #fca5a5"}}>🍽️ {cs}</span>)}</div>}
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{q.tags.map(t=><span key={t} style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:"#f9fafb",color:"#6b7280",border:"1px solid #e5e7eb"}}>{t}</span>)}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:10,color:"#9ca3af"}}>Per {serviceType==="full"?"plate":"portion"}</div>
                      <div style={{fontSize:20,fontWeight:900,color:q.withinBudget?"#16a34a":"#ef4444"}}>₹{q.perPlateActual}</div>
                      <div style={{fontSize:10,color:"#9ca3af",marginTop:4}}>Total</div>
                      <div style={{fontSize:16,fontWeight:900,color:"#1f2937"}}>₹{q.totalPrice.toLocaleString()}</div>
                      {q.travelSurcharge>0&&<div style={{fontSize:10,color:"#ea580c"}}>+₹{q.travelSurcharge} travel</div>}
                    </div>
                  </div>

                  {/* Food Tasting Banner (bulk only) */}
                  {serviceType==="bulk"&&(
                    <div style={{display:"flex",alignItems:"center",gap:10,background:"linear-gradient(135deg,#fffbeb,#fff7ed)",border:"1px solid #fdba74",borderRadius:9,padding:"9px 12px",marginBottom:10}}>
                      <span style={{fontSize:20}}>🍱</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:"#92400e"}}>Book a Food Tasting Session</div>
                        <div style={{fontSize:11,color:"#6b7280"}}>Try 5–7 sample dishes at home before your bulk order</div>
                      </div>
                      {tastingBooked[q.id]?(
                        <span style={{fontSize:12,fontWeight:700,color:"#16a34a",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"4px 10px"}}>✅ Booked!</span>
                      ):(
                        <button onClick={()=>handleFoodTasting(q)} style={{background:"linear-gradient(135deg,#ea580c,#c0392b)",border:"none",borderRadius:7,padding:"6px 12px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                          Book ₹{FOOD_TASTING_FEE}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Quote code */}
                  <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:9,padding:"10px 14px",marginBottom:10}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Quote Code</div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{fontSize:15,fontWeight:800,fontFamily:"monospace",color:accent,letterSpacing:"0.08em"}}>{q.quoteCode}</span>
                      <button onClick={()=>copyCode(q.quoteCode)} style={{padding:"5px 12px",borderRadius:7,background:"#fff",border:"1px solid #e5e7eb",color:"#6b7280",fontSize:11,cursor:"pointer"}}>{copiedCode===q.quoteCode?"✅ Copied!":"📋 Copy"}</button>
                    </div>
                  </div>

                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <button onClick={()=>setExpandedCaterer(expandedCaterer===q.id?null:q.id)} style={{background:"none",border:"none",color:"#9ca3af",fontSize:12,cursor:"pointer",padding:"2px 0"}}>{expandedCaterer===q.id?"▲ Hide":"▼ Details"}</button>
                    <button onClick={()=>{setSelectedQuote(q);setStep(6);}} style={{...S.primaryBtn,marginTop:0,flex:1,padding:"9px 16px",fontSize:13,background:accentGrad}}>Select & Place Order →</button>
                  </div>

                  {expandedCaterer===q.id&&<div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #fde8d8"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7}}>Menu ({q.itemsCovered} dishes)</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>{selectedItems.slice(0,10).map(item=><span key={item} style={{fontSize:11,padding:"3px 9px",borderRadius:10,background:"#f9fafb",color:"#374151",border:"1px solid #e5e7eb"}}>✓ {item}</span>)}{selectedItems.length>10&&<span style={{fontSize:11,padding:"3px 9px",borderRadius:10,background:"#f9fafb",color:"#9ca3af"}}>+{selectedItems.length-10} more</span>}</div>
                    <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7}}>{serviceType==="full"?"Full Service Inclusions":"Bulk Delivery Inclusions"}</div>
                    <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:4,color:"#6b7280",fontSize:12}}>
                      {(serviceType==="full"?["✓ Serving staff on-site","✓ Cutlery, crockery & serveware","✓ Food counter setup & decoration","✓ Post-event cleanup"]:["✓ Food packed in containers","✓ Home/venue delivery","✓ No staff or setup","✓ Disposable cutlery on request"]).map(item=><li key={item}>{item}</li>)}
                    </ul>
                  </div>}
                </div>
              ))}

              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button onClick={()=>setStep(4)} style={S.secondaryBtn}>← Modify Menu</button>
                <button onClick={resetApp} style={{...S.secondaryBtn,color:"#ef4444",borderColor:"#fecaca"}}>Start Over</button>
              </div>
            </div>}

            {/* Step 6: Address */}
            {step===6&&!orderPlaced&&selectedQuote&&<div>
              <h2 style={S.cardTitle}>{serviceType==="full"?"Event Venue Address":"Delivery Address"}</h2>
              <p style={{fontSize:14,color:"#6b7280",marginBottom:18}}>{serviceType==="full"?"Where will the event be held?":"Where should the food be delivered?"}</p>
              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"12px 16px",marginBottom:20}}>
                <div style={{fontSize:11,color:"#16a34a",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Selected Caterer</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"#1f2937"}}>{selectedQuote.logo} {selectedQuote.name}</div>
                    <div style={{fontSize:12,color:"#9ca3af"}}>
                      {unlockedPhones[selectedQuote.id]?<span style={{color:"#16a34a",fontWeight:700}}>📞 +91 {unlockedPhones[selectedQuote.id]}</span>:<span>📞 {String(selectedQuote.phone).slice(0,5)}•••••</span>}
                      · {selectedQuote.distanceKm} km away
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:12,color:"#9ca3af"}}>₹{selectedQuote.perPlateActual} × {guestCount}</div>
                    <div style={{fontSize:20,fontWeight:900,color:"#16a34a"}}>₹{selectedQuote.totalPrice.toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <div className="form-grid" style={S.formGrid}>
                {[["Flat / House No. *","flat","e.g. Flat 4B"],["Building / Society *","building","e.g. Suncity Apartments"]].map(([lbl,key,ph])=>(
                  <div key={key} style={S.fieldWrap}><label style={S.fieldLabel}>{lbl}</label>
                    <input style={{...S.inp2,borderColor:addressErrors[key]?"#ef4444":"#e5e7eb"}} value={deliveryAddress[key]} onChange={e=>setDeliveryAddress({...deliveryAddress,[key]:e.target.value})} placeholder={ph}/>
                    {addressErrors[key]&&<div style={{fontSize:11,color:"#ef4444"}}>{addressErrors[key]}</div>}
                  </div>
                ))}
                <div style={{...S.fieldWrap,gridColumn:"1 / -1"}}><label style={S.fieldLabel}>Street / Area *</label>
                  <input style={{...S.inp2,borderColor:addressErrors.street?"#ef4444":"#e5e7eb"}} value={deliveryAddress.street} onChange={e=>setDeliveryAddress({...deliveryAddress,street:e.target.value})} placeholder="e.g. Action Area I, Newtown"/>
                  {addressErrors.street&&<div style={{fontSize:11,color:"#ef4444"}}>{addressErrors.street}</div>}
                </div>
                <div style={S.fieldWrap}><label style={S.fieldLabel}>Landmark (optional)</label><input style={S.inp2} value={deliveryAddress.landmark} onChange={e=>setDeliveryAddress({...deliveryAddress,landmark:e.target.value})} placeholder="Near school, post office..."/></div>
                <div style={S.fieldWrap}><label style={S.fieldLabel}>Pincode *</label>
                  <input style={{...S.inp2,borderColor:addressErrors.pincode?"#ef4444":"#e5e7eb"}} type="tel" maxLength={6} value={deliveryAddress.pincode} onChange={e=>setDeliveryAddress({...deliveryAddress,pincode:e.target.value.replace(/\D/g,"")})} placeholder="6-digit pincode"/>
                  {addressErrors.pincode&&<div style={{fontSize:11,color:"#ef4444"}}>{addressErrors.pincode}</div>}
                </div>
                <div style={S.fieldWrap}><label style={S.fieldLabel}>City</label><input style={{...S.inp2,background:"#f9fafb",color:"#9ca3af"}} value="Kolkata" readOnly/></div>
                <div style={S.fieldWrap}><label style={S.fieldLabel}>State</label><input style={{...S.inp2,background:"#f9fafb",color:"#9ca3af"}} value="West Bengal" readOnly/></div>
              </div>
              <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,padding:"14px 18px",marginTop:16}}>
                <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Order Summary</div>
                {[["Service",stCfg?.label],["Event",eventType],["Guests",guestCount],["Per "+(serviceType==="full"?"plate":"portion"),`₹${selectedQuote.perPlateActual} (budget ₹${perPlateBudget})`],["Food Total",`₹${selectedQuote.basePrice.toLocaleString()}`],...(selectedQuote.travelSurcharge>0?[["Travel",`+₹${selectedQuote.travelSurcharge}`]]:[])]
                  .map(([lbl,val])=><div key={lbl} style={{display:"flex",justifyContent:"space-between",marginBottom:7,fontSize:13}}><span style={{color:"#6b7280"}}>{lbl}</span><span style={{color:"#374151",textTransform:lbl==="Event"?"capitalize":"none"}}>{val}</span></div>)}
                <div style={{borderTop:"1px solid #e5e7eb",paddingTop:9,marginTop:4,display:"flex",justifyContent:"space-between",fontSize:17,fontWeight:800}}><span style={{color:"#1f2937"}}>Grand Total</span><span style={{color:"#16a34a"}}>₹{selectedQuote.totalPrice.toLocaleString()}</span></div>
              </div>
              <div style={{display:"flex",gap:10,marginTop:18}}>
                <button onClick={()=>setStep(5)} style={S.secondaryBtn}>← Back</button>
                <button onClick={placeOrder} style={{...S.primaryBtn,marginTop:0,flex:1,background:"linear-gradient(135deg,#16a34a,#15803d)"}}>Confirm Order ✅</button>
              </div>
            </div>}

            {/* Order confirmed */}
            {step===6&&orderPlaced&&<div style={{textAlign:"center"}}>
              <div style={{fontSize:68,marginBottom:14}}>🎉</div>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#1f2937",marginBottom:6}}>Order Confirmed!</h2>
              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:14,padding:"20px",marginBottom:16}}>
                <div style={{fontSize:22,fontWeight:900,fontFamily:"monospace",color:"#16a34a",letterSpacing:"0.1em",marginBottom:12}}>{orderPlaced.id}</div>
                {[["Caterer",orderPlaced.catererName],["Service",SVC[orderPlaced.serviceType]?.label],["Event",orderPlaced.eventType],["Guests",orderPlaced.guestCount],["Per plate",`₹${orderPlaced.perPlateActual}`],["Grand Total",`₹${orderPlaced.totalPrice?.toLocaleString()}`],["Address",orderPlaced.deliveryAddress]].map(([lbl,val])=>(
                  <div key={lbl} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:8,textAlign:"left",gap:10}}><span style={{color:"#6b7280",flexShrink:0}}>{lbl}</span><span style={{color:"#1f2937",textAlign:"right",fontWeight:lbl==="Grand Total"?800:400,textTransform:lbl==="Event"?"capitalize":"none"}}>{val}</span></div>
                ))}
              </div>
              <p style={{color:"#6b7280",fontSize:13,marginBottom:18,lineHeight:1.6}}>Aayojan will coordinate with the caterer and contact you at <strong style={{color:"#c0392b"}}>{user?.phone}</strong>. Caterer's number remains private. 🔒</p>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>{const d=DB.get();setDbData(d);navigate("dbview");setDbTab("orders");}} style={S.secondaryBtn}>View in DB 🗄️</button>
                <button onClick={()=>{navigate("landing");resetApp();}} style={{...S.primaryBtn,marginTop:0,flex:1}}>Back to Home</button>
              </div>
            </div>}
          </div>
        </div>
      )}

      <footer style={{textAlign:"center",marginTop:44,padding:"20px 20px 0",borderTop:"2px solid #fde8d8",fontSize:12,color:"#9ca3af",letterSpacing:"0.04em"}}>
        <div style={{fontSize:18,letterSpacing:10,color:"#fca5a5",marginBottom:6}}>✦ ✦ ✦ ✦ ✦</div>
        Aayojan © 2024 · Newtown, Kolkata · আয়োজন · Rajarhat · Action Area I, II & III · Salt Lake
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box;margin:0;padding:0; }
        body { background:#fef9f7; }
        input[type=range]{-webkit-appearance:none;appearance:none;height:5px;border-radius:3px;background:#fde8d8;outline:none;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;cursor:pointer;box-shadow:0 2px 8px rgba(192,57,43,0.25);}
        @keyframes loadSlide{from{width:0%}to{width:90%}}
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        @keyframes pgSpin{to{transform:rotate(360deg)}}
        button:hover{opacity:0.9;} input:focus{outline:none;border-color:#c0392b !important;} a{text-decoration:none;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:#fef9f7;} ::-webkit-scrollbar-thumb{background:#fca5a5;border-radius:2px;}
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S={
  root:{minHeight:"100vh",background:"#fef9f7",fontFamily:"'DM Sans',sans-serif",color:"#1f2937",paddingBottom:60,position:"relative"},
  bengaliTopBorder:{height:6,background:"linear-gradient(90deg,#c0392b,#e74c3c,#f97316,#e74c3c,#c0392b)",backgroundSize:"200% 100%"},
  bgPattern:{position:"fixed",top:0,left:0,right:0,bottom:0,backgroundImage:"radial-gradient(circle at 20% 20%,rgba(192,57,43,0.03) 0%,transparent 50%),radial-gradient(circle at 80% 80%,rgba(192,57,43,0.03) 0%,transparent 50%)",pointerEvents:"none"},
  header:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",borderBottom:"1px solid #fde8d8",position:"sticky",top:0,background:"rgba(255,249,247,0.95)",backdropFilter:"blur(10px)",zIndex:100,boxShadow:"0 1px 4px rgba(192,57,43,0.06)"},
  page:{maxWidth:820,margin:"0 auto",padding:"24px 18px"},
  card:{background:"#fff",border:"1px solid #fde8d8",borderRadius:18,padding:"28px 32px",boxShadow:"0 4px 20px rgba(192,57,43,0.06)"},
  cardTitle:{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,marginBottom:6,color:"#1f2937"},
  sectionTitle:{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#1f2937",marginBottom:20},
  ghostBtn:{background:"#fff",border:"1px solid #e5e7eb",color:"#6b7280",padding:"7px 12px",borderRadius:8,fontSize:12,cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"},
  primaryBtn:{background:"linear-gradient(135deg,#c0392b,#e74c3c)",color:"#fff",border:"none",padding:"12px 24px",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 14px rgba(192,57,43,0.3)",width:"100%",marginTop:8},
  secondaryBtn:{background:"#fff",color:"#6b7280",border:"1px solid #e5e7eb",padding:"11px 20px",borderRadius:10,fontSize:13,cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},
  btnRow:{display:"flex",gap:10,marginTop:18,alignItems:"center"},
  formGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16},
  fieldWrap:{display:"flex",flexDirection:"column",gap:5},
  fieldLabel:{fontSize:12,fontWeight:600,color:"#374151",letterSpacing:"0.03em"},
  inp2:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:9,padding:"10px 14px",color:"#1f2937",fontSize:13,outline:"none",transition:"border-color 0.2s"},
  tastingBanner:{background:"linear-gradient(135deg,#c0392b,#e74c3c,#b5451b)",borderRadius:18,padding:"24px 28px",display:"flex",gap:20,alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",marginBottom:36,boxShadow:"0 8px 24px rgba(192,57,43,0.25)",position:"relative",overflow:"hidden"},
};

// ─── Payment gateway styles ───────────────────────────────────────────────────
const PG={
  overlay:{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16},
  modal:{background:"#fff",borderRadius:18,width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,0.2)",overflow:"hidden"},
  header:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:"1px solid #f3f4f6",background:"#fef9f7"},
  pgLogo:{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,#c0392b,#e74c3c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17},
  amountBanner:{background:"linear-gradient(135deg,#fff5f5,#fff)",padding:"18px 20px",textAlign:"center",borderBottom:"1px solid #fde8d8"},
  methodBtn:{display:"flex",alignItems:"center",gap:12,padding:"14px",border:"1px solid #e5e7eb",borderRadius:11,cursor:"pointer",background:"#fff",transition:"all 0.15s",width:"100%",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},
  secureRow:{display:"flex",alignItems:"center",gap:6,justifyContent:"center",fontSize:11,color:"#9ca3af",marginTop:14,padding:"8px",background:"#f9fafb",borderRadius:8},
  cardPreview:{background:"linear-gradient(135deg,#c0392b,#9b1c1c)",borderRadius:12,padding:"18px 20px",marginBottom:16,boxShadow:"0 4px 12px rgba(192,57,43,0.3)"},
  lbl:{fontSize:12,fontWeight:600,color:"#374151",marginBottom:4,display:"block"},
  inp:{width:"100%",padding:"10px 12px",border:"1px solid",borderRadius:9,color:"#1f2937",fontSize:14,outline:"none",background:"#fff"},
  ferr:{fontSize:11,color:"#ef4444",marginTop:3},
  payBtn:{width:"100%",padding:"13px",background:"linear-gradient(135deg,#c0392b,#e74c3c)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 14px rgba(192,57,43,0.3)",marginTop:16},
  backLink:{background:"none",border:"none",color:"#9ca3af",fontSize:13,cursor:"pointer",marginBottom:14,display:"block",padding:0},
};

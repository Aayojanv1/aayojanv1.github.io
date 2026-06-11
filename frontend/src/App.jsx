import { useState, useEffect, useRef } from "react";
import { useAuth, getPartners, getAllPartners, addPartner, updatePartner, deletePartner, createOrder, getAllOrders, getUserOrders, savePayment, updateUserPhone, updateUserPreferences, updateUserProfile } from "./useFirebase";
import { matchCaterers, anonymize } from "./matchingPipeline";
import AayojanChatBot from "./AayojanChatBot";
import FeaturedSpotlight from "./FeaturedSpotlight";
import { getAttribution, getAttributionForEvent } from "./attribution";

const track = (event, params = {}) => {
  if (typeof window.gtag === 'function' && !window['ga-disable-G-VSGREVV7RS']) {
    window.gtag('event', event, params);
  }
};

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
  {id:"c1",name:"Das Catering Services",ownerName:"Ratan Das",phone:"9830012345",email:"ratan@dascatering.in",address:"Plot 5A, Action Area I",pincode:"700156",specialty:["Wedding","Party","Religious"],cuisineSpecialties:["Bengali","Multi-cuisine"],serviceTypes:["full"],tags:["Bengali Cuisine","Multi-course"],priceRange:"₹₹",logo:"🍛",rating:4.6,turnaround:"2–3 hrs",registeredAt:"2024-01-10",active:true,minGuests:30,maxGuests:400,pricePerPlateMin:250,pricePerPlateMax:700,yearsInBusiness:8,teamSize:12,totalOrders:45},
  {id:"c2",name:"Kolkata Dawat",ownerName:"Md. Irfan Ali",phone:"9736054321",email:"irfan@kolkatadawat.com",address:"EE-12, Action Area II",pincode:"700157",specialty:["Party","Corporate","Wedding"],cuisineSpecialties:["Mughlai","Kolkata Biryani","North Indian"],serviceTypes:["full","bulk"],tags:["Budget-friendly","Mughlai & Bengali"],priceRange:"₹₹",logo:"🍚",rating:4.5,turnaround:"1–2 hrs",registeredAt:"2024-02-05",active:true,minGuests:20,maxGuests:300,pricePerPlateMin:200,pricePerPlateMax:550,yearsInBusiness:5,teamSize:10,totalOrders:32},
  {id:"c3",name:"Mondal Home Catering",ownerName:"Priya Mondal",phone:"9674011223",email:"priya@mondalcatering.com",address:"Rajarhat Main Road",pincode:"700135",specialty:["Party","Birthday","Corporate"],cuisineSpecialties:["Bengali","Vegetarian Only"],serviceTypes:["full","bulk"],tags:["Home-style","Fresh","Small events"],priceRange:"₹",logo:"🏡",rating:4.4,turnaround:"2–3 hrs",registeredAt:"2024-03-01",active:true,minGuests:15,maxGuests:150,pricePerPlateMin:150,pricePerPlateMax:400,yearsInBusiness:3,teamSize:5,totalOrders:18},
  {id:"c4",name:"Thakurbarir Ranna",ownerName:"Goutam Banerjee",phone:"9800167890",email:"goutam@thakurbarir.com",address:"K-7 Rajarhat Main Road",pincode:"700135",specialty:["Wedding","Religious","Party"],cuisineSpecialties:["Bengali","Vegetarian Only"],serviceTypes:["full","bulk"],tags:["Authentic Bengali","Vegetarian"],priceRange:"₹₹",logo:"🪷",rating:4.7,turnaround:"2–3 hrs",registeredAt:"2024-03-15",active:true,minGuests:30,maxGuests:350,pricePerPlateMin:250,pricePerPlateMax:650,yearsInBusiness:6,teamSize:10,totalOrders:28},
  {id:"c5",name:"Event Meals Kolkata",ownerName:"Suresh Kumar",phone:"9051022334",email:"suresh@eventmeals.in",address:"Salt Lake Sector V",pincode:"700091",specialty:["Corporate","Party"],cuisineSpecialties:["North Indian","Multi-cuisine"],serviceTypes:["bulk"],tags:["Office lunch","Corporate events"],priceRange:"₹₹",logo:"🍱",rating:4.3,turnaround:"1–2 hrs",registeredAt:"2024-04-10",active:true,minGuests:10,maxGuests:200,pricePerPlateMin:120,pricePerPlateMax:350,yearsInBusiness:4,teamSize:7,totalOrders:22},
  {id:"c6",name:"Annapurna Caterers",ownerName:"Sumitra Devi",phone:"9339044556",email:"sumitra@annapurna.com",address:"New Town Connector, Block D",pincode:"700157",specialty:["Wedding","Religious","Party"],cuisineSpecialties:["Bengali","North Indian"],serviceTypes:["full"],tags:["Wedding specialist","Traditional"],priceRange:"₹₹",logo:"🪔",rating:4.6,turnaround:"2–4 hrs",registeredAt:"2024-05-01",active:true,minGuests:40,maxGuests:500,pricePerPlateMin:280,pricePerPlateMax:800,yearsInBusiness:10,teamSize:15,totalOrders:52},
  {id:"c7",name:"Spice Kitchen Catering",ownerName:"Anirban Sen",phone:"9876012345",email:"anirban@spicekitchen.com",address:"Salt Lake BN Block",pincode:"700059",specialty:["Party","Corporate","Birthday"],cuisineSpecialties:["Chinese","Continental","Multi-cuisine"],serviceTypes:["full","bulk"],tags:["Modern cuisine","House parties"],priceRange:"₹₹",logo:"🌶️",rating:4.5,turnaround:"2–3 hrs",registeredAt:"2024-06-01",active:true,minGuests:20,maxGuests:250,pricePerPlateMin:200,pricePerPlateMax:600,yearsInBusiness:4,teamSize:8,totalOrders:15},
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

// Non-veg / egg / onion-garlic tags for dietary filtering
const NON_VEG_ITEMS=new Set(["Fish Fry","Prawn Cocktail","Chicken Cutlet","Sorshe Ilish","Chingri Malai Curry","Kosha Mangsho","Mutton Curry","Kolkata Biryani"]);
const EGG_ITEMS=new Set(["Egg Devil"]);
const ONION_GARLIC_ITEMS=new Set(["Dal Makhani","Paneer Butter Masala","Tandoori Roti","Naan","Kosha Mangsho","Mutton Curry","Chicken Cutlet","Fish Fry"]);
const DAIRY_ITEMS=new Set(["Mishti Doi","Lassi","Payesh","Paneer Butter Masala","Ice Cream Counter","Curd Rice","Malpua","Gulab Jamun"]);

function filterMenuByDiet(items,diet){
  if(diet==="any"||diet==="nonveg") return items;
  return items.filter(item=>{
    if(diet==="veg") return !NON_VEG_ITEMS.has(item)&&!EGG_ITEMS.has(item);
    if(diet==="eggetarian") return !NON_VEG_ITEMS.has(item);
    if(diet==="jain") return !NON_VEG_ITEMS.has(item)&&!EGG_ITEMS.has(item)&&!ONION_GARLIC_ITEMS.has(item);
    if(diet==="satvik") return !NON_VEG_ITEMS.has(item)&&!EGG_ITEMS.has(item)&&!ONION_GARLIC_ITEMS.has(item);
    if(diet==="vegan") return !NON_VEG_ITEMS.has(item)&&!EGG_ITEMS.has(item)&&!DAIRY_ITEMS.has(item);
    return true;
  });
}

const EVENT_TYPES=[
  {id:"wedding",label:"Wedding",icon:"💍",desc:"Biye, annaprasan & grand receptions"},
  {id:"party",label:"Party",icon:"🎉",desc:"Birthday, anniversary & get-togethers"},
  {id:"corporate",label:"Corporate",icon:"🏢",desc:"Office events & team lunches"},
  {id:"religious",label:"Religious",icon:"🪔",desc:"Pujo, brata & community feasts"},
];

const DIETARY_TYPES=[
  {id:"any",label:"All Types",icon:"🍽️",desc:"Veg + Non-Veg, no restrictions",color:"#6b7280"},
  {id:"veg",label:"Pure Vegetarian",icon:"🥬",desc:"No meat, no fish, no egg",color:"#16a34a"},
  {id:"eggetarian",label:"Eggetarian",icon:"🥚",desc:"Vegetarian + eggs allowed",color:"#eab308"},
  {id:"nonveg",label:"Non-Vegetarian",icon:"🍗",desc:"All food types welcome",color:"#ef4444"},
  {id:"jain",label:"Jain",icon:"☸️",desc:"No onion, no garlic, no root vegetables",color:"#8b5cf6"},
  {id:"satvik",label:"Satvik",icon:"🙏",desc:"No onion, no garlic, simple pure cooking",color:"#f97316"},
  {id:"vegan",label:"Vegan",icon:"🌱",desc:"No dairy, no honey, no animal products",color:"#059669"},
];

// Map dietary type → which cuisineSpecialties tags qualify a caterer
const DIETARY_FILTERS={
  any:()=>true,
  nonveg:(cs)=>!cs.includes("Vegetarian Only")&&!cs.includes("Jain"),
  eggetarian:()=>true, // most can do egg
  veg:(cs)=>cs.includes("Vegetarian Only")||cs.includes("Jain")||cs.includes("Multi-cuisine"),
  jain:(cs)=>cs.includes("Jain"),
  satvik:(cs)=>cs.includes("Vegetarian Only")||cs.includes("Jain"), // satvik subset of veg
  vegan:(cs)=>cs.includes("Vegetarian Only")||cs.includes("Vegan"),
};

const STEPS=["Service","Location","Event & Diet","Guests & Budget","Menu","Quotes","Order"];
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
function AayojanChatbot({onOrderCreated,user,onLoginRequired,allCaterers,onStartOrderFlow}){
  const [msgs,setMsgs]=useState([{role:"assistant",text:"নমস্কার! Aayojan Partner Advisor-এ আপনাকে স্বাগতম! 👋\n\nI'm here to help you grow your catering business with Aayojan — Kolkata's first AI-powered catering platform.\n\nAsk me about: **registration**, **pricing**, **how leads work**, or **the launch offer** 🚀"}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [orderData,setOrderData]=useState(null);
  const [confirmed,setConfirmed]=useState(false);
  const [msgCount,setMsgCount]=useState(0);
  const [blocked,setBlocked]=useState(false);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  // Profanity word list (lightweight client-side filter)
  const PROFANITY_RE=/\b(fuck|shit|ass|bitch|damn|bastard|dick|crap|cunt|whore|slut|nigger|faggot|retard|idiot|stupid|dumb|hate\s+you|kill\s+you|die)\b/i;
  const MAX_MSG_LENGTH=500;
  const MAX_MSGS_PER_SESSION=30;
  const OFF_TOPIC_WARNINGS=useRef(0);

  const SYSTEM=`You are Aayojan Partner Advisor, an AI assistant that helps caterers across Kolkata (Kolkata) understand and join the Aayojan catering platform. Your SOLE job is partner acquisition — convincing caterers to register.

STRICT RULES:
1) You ONLY discuss: Aayojan partnership benefits, how the platform works for caterers, commission structure, lead generation, food tasting programme, registration process. If asked unrelated questions, redirect: "I'm here to help you grow your catering business with Aayojan! 🍽️ What would you like to know about joining?"
2) If profanity/abuse: "Let's keep things professional! I'm here to help your catering business grow 📈"
3) Keep replies warm, concise (2-4 sentences), and persuasive. Use numbers and specifics.

KEY FACTS ABOUT AAYOJAN (use these in responses — be honest; we are LIVE and taking orders):
- Aayojan is Kolkata's Bengali catering marketplace — live and taking orders now
- We bring customers to caterers via WhatsApp + our AI planner — no app needed
- Areas: all over Kolkata & adjoining (Baguiati, VIP Road, Lake Town, Kestopur, Chinar Park, Dum Dum)
- 15+ kitchens in our network — the kitchen's name is shared once we match the customer
- Every kitchen is Aayojan-verified and FSSAI-checked before they cook for you
- Customers get matched to the right kitchen via the AI planner / WhatsApp, then connect
- Lead volume builds as customer base grows — early partners get priority placement

PRICING:
- Registration: ₹0 (free forever)
- Monthly fee: ₹0
- Commission: 3% per successful booking (only when caterer gets paid)
- EARLY PARTNER OFFER: Early partners get 0% commission for the first year
- No lock-in, no exclusivity, cancel anytime

HOW IT WORKS:
1. Caterer registers (2 min on WhatsApp — send menu, photos, service area)
2. We create their professional listing with photos
3. Customer searches → AI matches → Lead sent to caterer's WhatsApp
4. Caterer quotes price directly to customer
5. Customer books & pays caterer directly (cash/UPI/bank)
6. Aayojan invoices 3% monthly (or ₹0 for launch partners)

FOOD TASTING PROGRAMME:
- Customers pay ₹199 (veg) or ₹399 (non-veg) to taste 2 sample dishes
- Caterer keeps the tasting fee
- If customer books: tasting fee adjusted against final order
- Great for building trust and converting leads

OBJECTION HANDLING:
- "Why should I join?" → "You get qualified leads on WhatsApp for free. No investment, pay only when you earn."
- "I already have customers" → "Aayojan brings ADDITIONAL leads from people actively searching online. It's extra revenue, not replacement."
- "3% is too much" → "3% only on orders we bring you. Other apps can take up to 30%. Plus first 10 founding partners pay 0% for the first year."
- "How do I know leads are genuine?" → "We pre-qualify customers — they tell us event type, guest count, budget. You only get relevant leads matching your capacity."
- "What if I want to leave?" → "No contract, no lock-in. Leave anytime. Your data stays private."

REGISTRATION CTA: When caterer seems interested, say: "Ready to register? Just WhatsApp us at +91-8088434425 with your business name, cuisine type, and service area. Takes 2 minutes! Or visit aayojan.online/partners.html 🚀"

TONE: Professional yet friendly. Use Bengali phrases occasionally (e.g., "আপনার business বাড়বে!"). Be enthusiastic about food. Make caterers feel valued — they're the heart of the platform.`;

  const sendMessage=async()=>{
    const text=input.trim();if(!text||loading)return;

    // Guard: blocked session
    if(blocked){
      setInput("");
      setMsgs(prev=>[...prev,{role:"user",text},{role:"assistant",text:"⚠️ This session has been paused due to too many messages. Please refresh the page to start a new conversation."}]);
      return;
    }

    // Guard: max message length
    if(text.length>MAX_MSG_LENGTH){
      setInput("");
      setMsgs(prev=>[...prev,{role:"user",text:text.slice(0,100)+"..."},{role:"assistant",text:`✂️ Please keep your message under ${MAX_MSG_LENGTH} characters. Try to be concise about your catering needs!`}]);
      return;
    }

    // Guard: profanity filter
    if(PROFANITY_RE.test(text)){
      setInput("");
      OFF_TOPIC_WARNINGS.current++;
      if(OFF_TOPIC_WARNINGS.current>=3){setBlocked(true);setMsgs(prev=>[...prev,{role:"user",text:"[message filtered]"},{role:"assistant",text:"🚫 This session has been paused due to repeated inappropriate language. Please refresh the page to start over."}]);return;}
      setMsgs(prev=>[...prev,{role:"user",text:"[message filtered]"},{role:"assistant",text:"Let's keep things friendly! 😊 I'm here to help plan amazing food for your event. What kind of catering do you need?"}]);
      return;
    }

    // Guard: rate limit per session
    if(msgCount>=MAX_MSGS_PER_SESSION){
      setBlocked(true);
      setInput("");
      setMsgs(prev=>[...prev,{role:"user",text},{role:"assistant",text:"📋 You've reached the message limit for this session. If you haven't placed an order yet, please refresh the page to start a new conversation!"}]);
      return;
    }

    setInput("");setMsgCount(c=>c+1);
    track('ai_chat_message',{message_number:msgCount+1});
    const newMsgs=[...msgs,{role:"user",text}];setMsgs(newMsgs);setLoading(true);
    try{
      const API_URL=import.meta.env.VITE_API_URL||"http://localhost:8000";
      // Only send last 10 messages to limit token usage
      const recentMsgs=newMsgs.slice(-10);
      const res=await fetch(`${API_URL}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:recentMsgs.map(m=>({role:m.role,content:m.text.replace(/###ORDER_JSON###[\s\S]*?###END_JSON###/g,"").trim()})),system_prompt:SYSTEM})});
      const data=await res.json();
      const reply=data.reply||"Sorry, try again.";
      const jm=reply.match(/###ORDER_JSON###\s*([\s\S]*?)\s*###END_JSON###/);
      if(jm){try{setOrderData(JSON.parse(jm[1]));}catch(e){}}
      setMsgs(prev=>[...prev,{role:"assistant",text:reply.replace(/###ORDER_JSON###[\s\S]*?###END_JSON###/g,"").trim()}]);
    }catch(e){setMsgs(prev=>[...prev,{role:"assistant",text:"⚠️ Connection error. Please try again."}]);}
    setLoading(false);
  };

  const [matchResults,setMatchResults]=useState(null);

  const confirmOrder=()=>{
    if(!user){onLoginRequired();return;}

    // Run matching pipeline on confirmed order
    if(allCaterers?.length>0 && orderData?.pincode){
      const coords=PINCODE_COORDS[orderData.pincode];
      if(coords){
        const withDist=allCaterers.map(c=>{const cc=PINCODE_COORDS[c.pincode];const dist=cc?Math.round(haversineKm(coords.lat,coords.lng,cc.lat,cc.lng)*10)/10:99;const extraKm=Math.max(0,dist-BASE_KM);return{...c,distanceKm:dist,extraKm:parseFloat(extraKm.toFixed(1)),surcharge:Math.round(extraKm*KM_RATE)};});
        const dietPref=orderData.eventType==="religious"?"satvik":"any";
        const result=matchCaterers(withDist,{serviceType:orderData.serviceType||"full",eventType:orderData.eventType,guestCount:orderData.guestCount,perPlateBudget:orderData.perPlateBudget,selectedItems:orderData.menuItems||[],maxDistanceKm:15,topN:5,dietaryPref:dietPref,dietaryFilter:DIETARY_FILTERS[dietPref]});
        const anonResults=anonymize(result.results);
        setMatchResults({caterers:anonResults,pipeline:result.pipeline});
      }
    }

    const order={id:`CHAT-${Date.now()}`,source:"chatbot",customerId:user.uid,customerPhone:user.phone,...orderData,status:"Quotation Requested",placedAt:new Date().toISOString()};
    DB.saveChatOrder(order);onOrderCreated(order);setConfirmed(true);
    setMsgs(prev=>[...prev,{role:"assistant",text:`✅ **Order placed!** ID: **${order.id}**\n\nWe'll contact caterers and reach you at ${user.phone} within 48 hours. Dhonnobad! 🙏`}]);setOrderData(null);
  };

  const FOOD_EMOJIS={"biryani":"🍚","rice":"🍚","pulao":"🍚","chicken":"🍗","mutton":"🍖","fish":"🐟","ilish":"🐟","chingri":"🦐","prawn":"🦐","paneer":"🧀","dal":"🫘","luchi":"🫓","roti":"🫓","naan":"🫓","paratha":"🫓","starter":"🥘","cutlet":"🍢","fry":"🍟","tikka":"🍢","kebab":"🍢","chap":"🍖","chaap":"🍖","kosha":"🍖","dessert":"🍮","mishti":"🍮","rasgolla":"🍡","gulab":"🍩","ice cream":"🍨","sweet":"🍬","drink":"🥤","mocktail":"🍹","lassi":"🥛","salad":"🥗","soup":"🍲","curry":"🍛","dosa":"🫓","samosa":"🥟","roll":"🌯","chowmein":"🍜","makhani":"🍛","dom":"🥘","doi":"🍮"};
  const getFoodEmoji=(text)=>{const t=text.toLowerCase();for(const[k,v]of Object.entries(FOOD_EMOJIS))if(t.includes(k))return v;return"🍽️";};
  const renderFoodCard=(itemName,price,i)=>(
    <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",margin:"4px 0",borderRadius:12,background:"linear-gradient(135deg,rgba(192,57,43,0.04),rgba(231,76,60,0.08))",border:"1px solid rgba(192,57,43,0.12)",transition:"transform 0.2s"}}>
      <span style={{fontSize:22,filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.1))"}}>{getFoodEmoji(itemName)}</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:13,color:"var(--text-primary)"}}>{itemName.trim()}</div>
        {price&&<div style={{fontSize:11,color:"#c0392b",fontWeight:600,marginTop:1}}>{price}</div>}
      </div>
      <div style={{width:6,height:6,borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 4px #4ade80"}}/>
    </div>
  );
  const renderText=(text)=>{
    const lines=text.split('\n');
    const result=[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      // Detect menu item lines: "- Item Name — ₹XX" or "• Item — ₹XX"
      const menuMatch=line.match(/^[\s]*[-•●▪]\s*(.+?)[\s]*[—\-–:]\s*(₹[\d,]+-?₹?[\d,]*\/?(?:plate|portion|pax)?.*?)$/i);
      if(menuMatch){
        const itemName=menuMatch[1].replace(/^[🍗🍚🍖🐟🦐🧀🍛🍮🍡🍢🥘🍹🥤🫓🍲🥟🌯🍜🍟🍨🍩🍬🥗🫘🍡]\s*/,"");
        result.push(renderFoodCard(itemName,menuMatch[2],`card-${i}`));
        continue;
      }
      // Detect "* **Category:** item1, item2, item3" format (Gemini fallback)
      const catListMatch=line.match(/^[\s]*[*•●-]\s*\*?\*?([^*:]+)\*?\*?\s*:\s*(.+)$/);
      if(catListMatch){
        const catName=catListMatch[1].replace(/[🥘🍛🍮🍹🍗🍚]/g,"").trim();
        const items=catListMatch[2].split(/,|&/).map(s=>s.trim()).filter(Boolean);
        if(items.length>1&&(catName.toLowerCase().includes("starter")||catName.toLowerCase().includes("main")||catName.toLowerCase().includes("dessert")||catName.toLowerCase().includes("drink")||catName.toLowerCase().includes("side")||catName.toLowerCase().includes("bread")||catName.toLowerCase().includes("course"))){
          result.push(<div key={`hdr-${i}`} style={{fontSize:12,fontWeight:800,color:"#c0392b",textTransform:"uppercase",letterSpacing:"0.06em",marginTop:10,marginBottom:4,paddingBottom:4,borderBottom:"1px dashed rgba(192,57,43,0.2)"}}>{catName}</div>);
          items.forEach((item,j)=>result.push(renderFoodCard(item,null,`card-${i}-${j}`)));
          continue;
        }
      }
      // Detect section headers like "**🥘 Starters:**"
      const headerMatch=line.match(/^[\s]*\*\*([^*]+)\*\*:?\s*$/);
      if(headerMatch&&(line.toLowerCase().includes("starter")||line.toLowerCase().includes("main")||line.toLowerCase().includes("dessert")||line.toLowerCase().includes("drink")||line.toLowerCase().includes("bread")||line.toLowerCase().includes("side")||line.toLowerCase().includes("menu")||line.toLowerCase().includes("package")||line.toLowerCase().includes("course"))){
        result.push(<div key={`hdr-${i}`} style={{fontSize:12,fontWeight:800,color:"#c0392b",textTransform:"uppercase",letterSpacing:"0.06em",marginTop:10,marginBottom:4,paddingBottom:4,borderBottom:"1px dashed rgba(192,57,43,0.2)"}}>{headerMatch[1].replace(/[🥘🍛🍮🍹🍗🍚]/g,"").trim()}</div>);
        continue;
      }
      // Regular text with bold support
      const parts=line.split(/(\*\*[^*]+\*\*)/g);
      result.push(<span key={i}>{parts.map((p,j)=>p.startsWith('**')&&p.endsWith('**')?<strong key={j} style={{color:"var(--text-primary)"}}>{p.slice(2,-2)}</strong>:<span key={j}>{p}</span>)}{i<lines.length-1&&<br/>}</span>);
    }
    return result;
  };

  return(
    <div style={{background:"var(--bg-card)",border:"1px solid var(--border-light)",borderRadius:18,overflow:"hidden",boxShadow:"0 8px 30px rgba(192,57,43,0.12)",display:"flex",flexDirection:"column",height:"76vh",maxHeight:660}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",background:"linear-gradient(135deg,#c0392b,#e74c3c)"}}>
        <div style={{width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🤖</div>
        <div><div style={{fontWeight:800,color:"#fff",fontSize:15}}>Aayojan AI</div><div style={{fontSize:11,color:"rgba(255,255,255,0.8)",display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:"#4ade80",display:"inline-block"}}/>Online · Catering Expert</div></div>
        <div style={{marginLeft:"auto",fontSize:11,color:"rgba(255,255,255,0.7)",textAlign:"right"}}><div>Powered by</div><div style={{fontWeight:700,color:"#fff"}}>Gemini AI</div></div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px",display:"flex",flexDirection:"column",gap:0,background:"var(--bg-secondary)"}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:10}}>
            {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#c0392b,#e74c3c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginRight:8,alignSelf:"flex-end",marginBottom:2}}>🤖</div>}
            <div style={{maxWidth:"82%",background:m.role==="user"?"var(--chat-user-bg)":"var(--bg-card)",color:m.role==="user"?"#fff":"var(--text-primary)",borderRadius:m.role==="user"?"16px 16px 3px 16px":"16px 16px 16px 3px",padding:"10px 14px",fontSize:13,lineHeight:1.55,boxShadow:m.role==="assistant"?"0 1px 4px rgba(0,0,0,0.08)":"none",border:m.role==="assistant"?"1px solid var(--border-default)":"none"}}>
              {renderText(m.text)}
            </div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",gap:8,alignItems:"center"}}><div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#c0392b,#e74c3c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginRight:8}}>🤖</div><div style={{background:"var(--bg-card)",border:"1px solid var(--border-default)",borderRadius:"16px 16px 16px 3px",padding:"10px 14px",display:"flex",gap:4,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"var(--text-muted)",animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div></div>}
        {orderData&&!confirmed&&(
          <div style={{background:"var(--bg-card)",border:"2px solid #c0392b",borderRadius:14,padding:"14px",margin:"8px 0 8px 34px",boxShadow:"0 2px 12px rgba(192,57,43,0.1)"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#c0392b",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>📋 Order Summary — Ready?</div>
            {[["🛎️ Service",SVC[orderData.serviceType]?.label||orderData.serviceType],["🎊 Event",orderData.eventType],["👥 Guests",orderData.guestCount],["💰 Budget",`₹${orderData.perPlateBudget}/${orderData.serviceType==="full"?"plate":"portion"}`],["📍 Pincode",orderData.pincode],["🍽️ Menu",`${orderData.menuItems?.length||0} items`]].map(([lbl,val])=>(
              <div key={lbl} style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}><span style={{color:"var(--text-secondary)"}}>{lbl}</span><span style={{color:"var(--text-primary)",fontWeight:600,textTransform:"capitalize"}}>{val}</span></div>
            ))}
            {orderData.menuItems?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,margin:"8px 0"}}>{orderData.menuItems.map(item=><span key={item} style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:"var(--bg-accent-light)",color:"var(--text-accent)",border:"1px solid var(--border-accent)"}}>{item}</span>)}</div>}
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={()=>setOrderData(null)} style={{flex:1,padding:"9px",borderRadius:8,background:"var(--bg-hover)",border:"1px solid var(--border-default)",color:"var(--text-secondary)",cursor:"pointer",fontSize:12}}>Edit</button>
              <button onClick={confirmOrder} style={{flex:2,padding:"9px",borderRadius:8,background:"linear-gradient(135deg,#16a34a,#15803d)",border:"none",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>✅ Confirm & Send</button>
            </div>
          </div>
        )}
        {/* Matched caterers from pipeline — shown after confirmation */}
        {confirmed&&matchResults&&matchResults.caterers.length>0&&(
          <div style={{background:"var(--bg-card)",border:"2px solid #16a34a",borderRadius:14,padding:"14px",margin:"8px 0 8px 34px",boxShadow:"0 2px 12px rgba(22,163,74,0.1)"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#16a34a",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>🏆 {matchResults.caterers.length} Caterers Matched</div>
            <div style={{fontSize:10,color:"var(--text-secondary)",marginBottom:10}}>Pipeline: {matchResults.pipeline.totalCaterers} total → {matchResults.pipeline.afterRetrieval} eligible → {matchResults.pipeline.finalCount} selected</div>
            {matchResults.caterers.map((c,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,background:i===0?"#f0fdf4":"var(--bg-secondary)",border:i===0?"1px solid #bbf7d0":"1px solid var(--border-default)",marginBottom:6}}>
                <span style={{fontSize:18}}>{c._anonIcon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>{c._anonLabel}</div>
                  <div style={{fontSize:10,color:"var(--text-secondary)"}}>⭐{c.rating} · 📍{c.distanceKm}km · {c.cuisineSpecialties?.slice(0,2).join(", ")}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:14,fontWeight:800,color:i===0?"#16a34a":"var(--text-primary)"}}>{c._matchPercent}%</div>
                  <div style={{fontSize:9,color:"var(--text-secondary)"}}>match</div>
                </div>
              </div>
            ))}
            {matchResults.caterers.some(c=>c._boostReasons?.length>0)&&(
              <div style={{fontSize:10,color:"#92400e",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"5px 8px",marginTop:4}}>🌱 Some results boosted to support new/growing businesses</div>
            )}
            {onStartOrderFlow&&<button onClick={()=>onStartOrderFlow(matchResults.caterers[0])} style={{width:"100%",padding:"9px",borderRadius:8,background:"linear-gradient(135deg,#c0392b,#e74c3c)",border:"none",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,marginTop:8}}>Continue to Full Quote Flow →</button>}
          </div>
        )}
        {confirmed&&matchResults&&matchResults.caterers.length===0&&(
          <div style={{background:"var(--bg-card)",border:"1px solid #fecaca",borderRadius:14,padding:"14px",margin:"8px 0 8px 34px"}}>
            <div style={{fontSize:12,color:"#ef4444",fontWeight:600}}>😔 No caterers matched your criteria in this area. Try adjusting your pincode, budget, or dietary preferences.</div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      {msgs.length===1&&<div style={{padding:"6px 12px 4px",display:"flex",gap:6,flexWrap:"wrap",borderTop:"1px solid var(--border-default)",background:"var(--bg-card)"}}>
        {["🚀 How do I register?","💰 What's the commission?","📲 How do leads work?","🎁 Tell me about the launch offer"].map(p=><button key={p} onClick={()=>{setInput(p);setTimeout(()=>inputRef.current?.focus(),50);}} style={{fontSize:11,padding:"5px 10px",borderRadius:12,background:"var(--bg-accent-light)",border:"1px solid var(--border-accent)",color:"var(--text-accent)",cursor:"pointer",whiteSpace:"nowrap"}}>{p}</button>)}
      </div>}
      <div style={{display:"flex",gap:8,padding:"10px 12px",borderTop:"1px solid var(--border-default)",background:"var(--bg-card)",flexDirection:"column"}}>
        <div style={{display:"flex",gap:8}}>
          <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value.slice(0,MAX_MSG_LENGTH))} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()} placeholder={blocked?"Session paused — refresh to start over":"Ask about registration, pricing, leads..."} disabled={blocked} style={{flex:1,background:"var(--bg-hover)",border:"1px solid var(--border-default)",borderRadius:12,padding:"10px 14px",color:"var(--text-primary)",fontSize:13,outline:"none",opacity:blocked?0.5:1}}/>
          <button onClick={sendMessage} disabled={!input.trim()||loading||blocked} style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#c0392b,#e74c3c)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:input.trim()&&!loading&&!blocked?1:0.4}}>➤</button>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--text-muted)",padding:"0 4px"}}>
          <span>{input.length}/{MAX_MSG_LENGTH}</span>
          <span>{MAX_MSGS_PER_SESSION-msgCount} messages remaining</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function AayojanApp(){
  const [view,setView]=useState("landing");
  const [menuOpen,setMenuOpen]=useState(false);
  const [animIn,setAnimIn]=useState(true);

  // Dark mode
  const [darkMode,setDarkMode]=useState(()=>{
    // Default to LIGHT mode. Ignore OS preference; clear any saved dark setting
    // so existing visitors who got auto-dark are flipped back to the bright brand.
    try {
      if (localStorage.getItem("aayojan-dark-mode") === "true") {
        localStorage.removeItem("aayojan-dark-mode");
      }
    } catch(e) {}
    return false;
  });
  useEffect(()=>{
    document.documentElement.setAttribute("data-theme",darkMode?"dark":"light");
    localStorage.setItem("aayojan-dark-mode",darkMode);
  },[darkMode]);

  // ── Hero rotating word — cinematic kinetic typography ───────────────────
  const HERO_WORDS = [
    {word:"wedding",        accent:"#F3C869"},
    {word:"Annaprasan",     accent:"#FBBF77"},
    {word:"Bhai Phota",     accent:"#F3C869"},
    {word:"office lunch",   accent:"#FBBF77"},
    {word:"Griha Pravesh",  accent:"#F3C869"},
    {word:"birthday bash",  accent:"#FBBF77"},
    {word:"Aiburo Bhaat",   accent:"#F3C869"},
  ];
  const [heroIdx,setHeroIdx] = useState(0);
  const [heroFade,setHeroFade] = useState(false);
  useEffect(()=>{
    const t = setInterval(()=>{
      setHeroFade(true);
      setTimeout(()=>{
        setHeroIdx(i => (i+1) % HERO_WORDS.length);
        setHeroFade(false);
      }, 320);
    }, 2600);
    return ()=> clearInterval(t);
  },[]);

  // ── Hero activity ticker (simulated recent bookings — adds liveness) ──
  const TICKER = [
    "🍛 Mutton biryani for 350 · Newtown · 23 min ago",
    "🐟 Doi Ilish for Annaprasan · Salt Lake · 1 hr ago",
    "🍢 Galouti kebab counter · Hyatt Newtown · 2 hrs ago",
    "🥟 Hakka noodles for office town-hall · Sector V · 3 hrs ago",
    "🍮 Mishti doi · Bhai Phota · Salt Lake · 4 hrs ago",
    "🍕 Continental cocktail dinner · DLF lawns · 5 hrs ago",
    "🌿 Niramish Griha Pravesh · Rajarhat · today",
    "🎂 Kids birthday spread · Eco Park · today",
  ];

  // Auth — Firebase
  const {user,loading:authLoading,loginWithGoogle,loginWithEmail,signupWithEmail,logout,refreshUser}=useAuth();
  const [showLogin,setShowLogin]=useState(false);
  const [loginMode,setLoginMode]=useState("login"); // "login"|"signup"
  const [loginEmail,setLoginEmail]=useState("");
  const [loginPassword,setLoginPassword]=useState("");
  const [loginName,setLoginName]=useState("");
  const [loginError,setLoginError]=useState("");
  const [loginLoading,setLoginLoading]=useState(false);
  const [phoneInput,setPhoneInput]=useState("");
  const [showPhonePrompt,setShowPhonePrompt]=useState(false);
  const [showPreferences,setShowPreferences]=useState(false);
  const [prefStep,setPrefStep]=useState(0); // 0=dietary, 1=cuisines, 2=budget&extras
  const [prefData,setPrefData]=useState({dietary:"non-veg",cuisines:[],budgetRange:"moderate",spiceLevel:"medium",guestSizePreference:"50-100",allergies:[],favoriteEventTypes:[]});
  const [prefSaving,setPrefSaving]=useState(false);

  // Profile
  const [profileTab,setProfileTab]=useState("info"); // info | orders | preferences
  const [profileEdit,setProfileEdit]=useState(false);
  const [profileForm,setProfileForm]=useState({displayName:"",phone:"",address:"",pincode:"",city:"Kolkata"});
  const [profileSaving,setProfileSaving]=useState(false);
  const [userOrders,setUserOrders]=useState([]);
  const [ordersLoading,setOrdersLoading]=useState(false);

  // Service & flow
  const [serviceType,setServiceType]=useState(null);
  const [step,setStep]=useState(0);
  const [customerPincode,setCustomerPincode]=useState("");
  const [pincodeError,setPincodeError]=useState("");
  const [customerCoords,setCustomerCoords]=useState(null);
  const [eventType,setEventType]=useState(null);
  const [eventDate,setEventDate]=useState("");
  const [mealTime,setMealTime]=useState("");
  const [dietaryPref,setDietaryPref]=useState("any");
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

  // Registration (admin adds partners)
  const [regForm,setRegForm]=useState({name:"",ownerName:"",phone:"",email:"",address:"",pincode:"",specialty:[],cuisineSpecialties:[],serviceTypes:[],priceRange:"₹₹",turnaround:"2–3 hrs",
    // Rich fields for ranker/retrieval
    minGuests:10,maxGuests:500,pricePerPlateMin:150,pricePerPlateMax:800,
    fssaiLicense:"",yearsInBusiness:"",teamSize:"",
    signatureDishes:"",description:"",
    deliveryPincodes:[],menuHighlights:[],
    vegOnly:false,hasLiveCounter:false,providesDecor:false,providesStaff:true,
    paymentModes:["Cash","UPI"],cancellationPolicy:"48hrs",
    availableDays:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
  });
  const [regErrors,setRegErrors]=useState({});
  const [regSuccess,setRegSuccess]=useState(false);
  const [regStep,setRegStep]=useState(0); // 0=basic, 1=service, 2=capacity, 3=menu&extras

  // DB view / Admin
  const [dbTab,setDbTab]=useState("caterers");
  const [dbData,setDbData]=useState({caterers:[],customers:[],quotationRequests:[],orders:[],chatOrders:[],payments:[]});
  const [firestoreCaterers,setFirestoreCaterers]=useState([]);
  const [adminPartners,setAdminPartners]=useState([]);
  const [adminOrders,setAdminOrders]=useState([]);
  const [adminLoading,setAdminLoading]=useState(false);
  const [editingPartner,setEditingPartner]=useState(null);

  useEffect(()=>{DB.init();setAnimIn(false);const t=setTimeout(()=>setAnimIn(true),60);return()=>clearTimeout(t);},[view,step]);
  useEffect(()=>{if(serviceType) setPerPlateBudget(SVC[serviceType].priceRange.min+100);},[serviceType]);

  // Hash-based deep linking (e.g. #partner-terms)
  useEffect(()=>{
    const h=window.location.hash.replace("#","");
    if(h&&["privacy","terms","refund","partner-terms","about"].includes(h)) setView(h);
  },[]);

  // Keep-alive ping to prevent Render cold starts (every 14 min)
  useEffect(()=>{
    const API_URL=import.meta.env.VITE_API_URL||"http://localhost:8000";
    const ping=()=>fetch(`${API_URL}/health`).catch(()=>{});
    ping(); // warm up on app load
    const interval=setInterval(ping,14*60*1000);
    return()=>clearInterval(interval);
  },[]);

  // Show preferences modal for first-time users (no preferences saved)
  const [prefShownOnce,setPrefShownOnce]=useState(false);
  useEffect(()=>{
    if(user && !user.preferences && !prefShownOnce && !showPreferences){
      setPrefShownOnce(true);
      setShowPreferences(true);
      setPrefStep(0);
    }
  },[user]);

  // Load caterers from Firestore on mount
  useEffect(()=>{
    getPartners().then(p=>{
      if(p.length>0) setFirestoreCaterers(p);
    });
  },[]);

  // Merged caterers: Firestore + seed data fallback
  const allCaterers=firestoreCaterers.length>0?firestoreCaterers:SEED_CATERERS;

  const navigate=(v)=>{setAnimIn(false);setTimeout(()=>{setView(v);setAnimIn(true);},80);};
  const anim={opacity:animIn?1:0,transform:animIn?"translateY(0)":"translateY(18px)",transition:"opacity 0.32s ease,transform 0.32s ease"};
  const stCfg=serviceType?SVC[serviceType]:SVC.full;
  const accent=stCfg.color;
  const accentGrad=stCfg.btnGrad;

  // ── Firebase Auth Handlers ──────────────────────────────────────────────
  const handleGoogleLogin=async()=>{
    setLoginError("");setLoginLoading(true);
    try{ await loginWithGoogle(); setShowLogin(false); track('login',{method:'google'}); }
    catch(e){ setLoginError(e.message); }
    finally{ setLoginLoading(false); }
  };
  const handleEmailAuth=async()=>{
    setLoginError("");
    if(!loginEmail||!loginPassword){setLoginError("Email and password required.");return;}
    if(loginMode==="signup"&&!loginName){setLoginError("Name is required.");return;}
    setLoginLoading(true);
    try{
      if(loginMode==="signup"){ await signupWithEmail(loginEmail,loginPassword,loginName); track('sign_up',{method:'email'}); }
      else{ await loginWithEmail(loginEmail,loginPassword); track('login',{method:'email'}); }
      setShowLogin(false);setLoginEmail("");setLoginPassword("");setLoginName("");
    }catch(e){
      const msg=e.code==="auth/user-not-found"?"No account found. Sign up instead."
        :e.code==="auth/wrong-password"?"Incorrect password."
        :e.code==="auth/email-already-in-use"?"Email already registered. Try login."
        :e.code==="auth/weak-password"?"Password must be at least 6 characters."
        :e.message;
      setLoginError(msg);
    }finally{setLoginLoading(false);}
  };
  const handleSavePhone=async()=>{
    if(!phoneInput||phoneInput.replace(/\D/g,"").length!==10)return;
    if(user) await updateUserPhone(user.uid,phoneInput);
    setShowPhonePrompt(false);setPhoneInput("");
  };

  // ── Save Preferences ──────────────────────────────────────────────────────
  const handleSavePreferences=async()=>{
    if(!user) return;
    setPrefSaving(true);
    try{
      await updateUserPreferences(user.uid, prefData);
      await refreshUser();
      setShowPreferences(false);
    }catch(e){ console.error("Pref save error:",e); }
    finally{ setPrefSaving(false); }
  };

  const togglePrefArray=(key,val)=>{
    setPrefData(prev=>{
      const arr=prev[key]||[];
      return{...prev,[key]:arr.includes(val)?arr.filter(v=>v!==val):[...arr,val]};
    });
  };

  // ── Profile Handlers ──────────────────────────────────────────────────────
  const openProfile=async()=>{
    if(!user) return;
    setProfileForm({
      displayName:user.displayName||"",
      phone:user.phone||"",
      address:user.address||"",
      pincode:user.pincode||"",
      city:user.city||"Kolkata",
    });
    if(user.preferences) setPrefData(user.preferences);
    setProfileEdit(false);
    setProfileTab("info");
    navigate("profile");
    // Load orders
    setOrdersLoading(true);
    const orders=await getUserOrders(user.uid);
    setUserOrders(orders);
    setOrdersLoading(false);
  };

  const handleSaveProfile=async()=>{
    if(!user) return;
    setProfileSaving(true);
    try{
      await updateUserProfile(user.uid, profileForm);
      await refreshUser();
      setProfileEdit(false);
    }catch(e){ console.error(e); }
    finally{ setProfileSaving(false); }
  };

  // ── Admin: load partners & orders ──────────────────────────────────────
  const loadAdminData=async()=>{
    setAdminLoading(true);
    const [p,o]=await Promise.all([getAllPartners(),getAllOrders()]);
    setAdminPartners(p);setAdminOrders(o);setAdminLoading(false);
  };

  // ── Pincode ───────────────────────────────────────────────────────────────
  const handlePincodeNext=()=>{
    const coords=PINCODE_COORDS[customerPincode.trim()];
    if(customerPincode.trim().length!==6||!coords){setPincodeError("Enter a valid Newtown/Kolkata pincode");return;}
    setPincodeError("");setCustomerCoords(coords);
    const withDist=allCaterers.map(c=>{const cc=PINCODE_COORDS[c.pincode];const dist=cc?Math.round(haversineKm(coords.lat,coords.lng,cc.lat,cc.lng)*10)/10:99;const extraKm=Math.max(0,dist-BASE_KM);return{...c,distanceKm:dist,extraKm:parseFloat(extraKm.toFixed(1)),surcharge:Math.round(extraKm*KM_RATE)};}).sort((a,b)=>a.distanceKm-b.distanceKm);
    setNearbyCaterers(withDist);setStep(2);
  };

  // ── Quotes (Pipeline: Retrieve → Rank → Rerank) ────────────────────────────
  const generateQuotes=()=>{
    if(!user){setShowLogin(true);return;}
    track('quote_requested',{event_type:eventType,service_type:serviceType,guest_count:guestCount,budget_per_plate:perPlateBudget});
    setLoading(true);
    setTimeout(()=>{
      // Run 3-stage matching pipeline
      const result=matchCaterers(nearbyCaterers,{serviceType,eventType,guestCount,perPlateBudget,selectedItems,maxDistanceKm:15,topN:5,dietaryPref,dietaryFilter:DIETARY_FILTERS[dietaryPref]||DIETARY_FILTERS.any});
      const anonResults=anonymize(result.results);
      const matched=anonResults.map(c=>{
        // Generate realistic quote based on caterer's price range + user budget
        const priceMin=c.pricePerPlateMin||150;const priceMax=c.pricePerPlateMax||1500;
        const fitPrice=Math.max(priceMin,Math.min(priceMax,perPlateBudget));
        const variance=(Math.random()-0.4)*0.15;
        const ppa=Math.max(SVC[serviceType].priceRange.min,Math.round((fitPrice*(1+variance))/10)*10);
        const base=ppa*guestCount;const tf=c.surcharge*Math.ceil(guestCount/50);
        return{...c,quoteCode:`${c.id.toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`,perPlateActual:ppa,basePrice:base,travelSurcharge:tf,totalPrice:base+tf,itemsCovered:selectedItems.length,withinBudget:ppa<=perPlateBudget};
      }).sort((a,b)=>a.perPlateActual-b.perPlateActual);
      const now=new Date();const qr={id:`QR-${Date.now()}`,customerId:user?.uid,customerEmail:user?.email,catererIds:matched.map(c=>c.id),eventType,eventDate,mealTime,serviceType,dietaryPref,guestCount,perPlateBudget,menuItems:selectedItems,customerPincode,sentAt:now.toISOString(),expiresAt:new Date(now.getTime()+WAIT_HRS*3600000).toISOString(),status:"Awaiting Responses",pipeline:result.pipeline,whatsappLog:matched.map(c=>({catererId:c.id,catererName:c._anonLabel,maskedPhone:"••••••••••",sentAt:now.toISOString(),status:"Sent ✅"}))};
      DB.saveQR(qr);setQuotationRequest(qr);setWhatsappSent(qr.whatsappLog);setQuotes(matched);setLoading(false);setStep(5);
      track('caterers_matched',{count:matched.length,event_type:eventType,service_type:serviceType});
    },1800);
  };

  // ── Payment handlers ──────────────────────────────────────────────────────
  const handleUnlockPhone=(caterer)=>{
    if(!user){setShowLogin(true);return;}
    if(unlockedPhones[caterer.id]){return;}
    setPaymentModal({amount:PHONE_UNLOCK_FEE,purpose:`Unlock ${caterer.name}'s contact number`,catererId:caterer.id,type:"phone_unlock",catererName:caterer.name,
      onSuccess:async()=>{
        await savePayment({customerId:user.uid,catererId:caterer.id,catererName:caterer.name,type:"phone_unlock",amount:PHONE_UNLOCK_FEE,status:"success",paidAt:new Date().toISOString()});
        track('phone_unlocked',{value:PHONE_UNLOCK_FEE,currency:'INR'});
        setUnlockedPhones(prev=>({...prev,[caterer.id]:caterer.phone}));
        setPaymentModal(null);
      }
    });
  };

  const handleFoodTasting=(caterer)=>{
    if(!user){setShowLogin(true);return;}
    if(tastingBooked[caterer.id]){return;}
    setPaymentModal({amount:FOOD_TASTING_FEE,purpose:`Book Food Tasting Session with ${caterer.name}`,catererId:caterer.id,type:"food_tasting",catererName:caterer.name,
      onSuccess:async()=>{
        await savePayment({customerId:user.uid,catererId:caterer.id,catererName:caterer.name,type:"food_tasting",amount:FOOD_TASTING_FEE,status:"success",paidAt:new Date().toISOString()});
        track('food_tasting_booked',{value:FOOD_TASTING_FEE,currency:'INR'});
        setTastingBooked(prev=>({...prev,[caterer.id]:true}));
        setPaymentModal(null);
      }
    });
  };

  // ── Order ─────────────────────────────────────────────────────────────────
  const validateAddress=()=>{const e={};if(!deliveryAddress.flat.trim())e.flat="Required";if(!deliveryAddress.building.trim())e.building="Required";if(!deliveryAddress.street.trim())e.street="Required";if(!deliveryAddress.pincode.trim()||deliveryAddress.pincode.length!==6)e.pincode="Valid 6-digit pincode required";setAddressErrors(e);return Object.keys(e).length===0;};
  const placeOrder=async()=>{if(!validateAddress())return;const order={quotationRequestId:quotationRequest?.id,customerId:user?.uid,customerEmail:user?.email,customerPhone:user?.phone||"",catererId:selectedQuote.id,catererName:selectedQuote._realName||selectedQuote.name,eventType,serviceType,guestCount,perPlateBudget,perPlateActual:selectedQuote.perPlateActual,menuItems:selectedItems,deliveryAddress:`${deliveryAddress.flat}, ${deliveryAddress.building}, ${deliveryAddress.street}${deliveryAddress.landmark?", "+deliveryAddress.landmark:""}, ${deliveryAddress.city} - ${deliveryAddress.pincode}`,deliveryPincode:deliveryAddress.pincode,distanceKm:selectedQuote.distanceKm,basePrice:selectedQuote.basePrice,travelSurcharge:selectedQuote.travelSurcharge,totalPrice:selectedQuote.totalPrice,quoteCode:selectedQuote.quoteCode,matchScore:selectedQuote._matchPercent,status:"Confirmed",placedAt:new Date().toISOString()};const orderId=await createOrder(order);track('order_placed',{event_type:eventType,service_type:serviceType,guest_count:guestCount,total_price:order.totalPrice,currency:'INR'});setOrderPlaced({id:orderId,...order});setStep(6);};

  // ── Registration ──────────────────────────────────────────────────────────
  const validateReg=()=>{const e={};if(!regForm.name.trim())e.name="Required";if(!regForm.ownerName.trim())e.ownerName="Required";if(!/^\d{10}$/.test(regForm.phone))e.phone="Valid 10-digit number";if(!regForm.email.includes("@"))e.email="Valid email required";if(!regForm.address.trim())e.address="Required";if(!PINCODE_COORDS[regForm.pincode.trim()])e.pincode="Valid Kolkata pincode";if(regForm.specialty.length===0)e.specialty="Select at least one";if(regForm.cuisineSpecialties.length===0)e.cuisineSpecialties="Select at least one";if(regForm.serviceTypes.length===0)e.serviceTypes="Select at least one";if(regForm.pricePerPlateMin>=regForm.pricePerPlateMax)e.pricing="Min must be less than max";const fssai=(regForm.fssaiLicense||"").trim();if(!fssai)e.fssaiLicense="FSSAI required — enter 14-digit number, or type 'Applied' if your application is in process";else if(!/^\d{14}$/.test(fssai)&&!/^applied$/i.test(fssai))e.fssaiLicense="Enter the 14-digit FSSAI number, or type 'Applied' if pending";setRegErrors(e);return Object.keys(e).length===0;};
  const submitReg=async()=>{if(!validateReg())return;const logos=["🍽️","🥘","🫕","🥗","🍛","🥞","🎂"];await addPartner({...regForm,pincode:regForm.pincode.trim(),logo:logos[Math.floor(Math.random()*logos.length)],tags:regForm.cuisineSpecialties.slice(0,3),turnaround:regForm.turnaround,deliveryPincodes:regForm.deliveryPincodes.length>0?regForm.deliveryPincodes:Object.keys(PINCODE_COORDS)});track('partner_registered',{cuisine:regForm.cuisineSpecialties[0],pincode:regForm.pincode});setRegSuccess(true);setRegStep(0);getPartners().then(p=>{if(p.length>0)setFirestoreCaterers(p);});};

  const copyCode=(code)=>{navigator.clipboard?.writeText(code);setCopiedCode(code);setTimeout(()=>setCopiedCode(null),2000);};
  const toggleItem=(item)=>setSelectedItems(prev=>prev.includes(item)?prev.filter(i=>i!==item):[...prev,item]);
  const addCustomItem=()=>{if(customItem.trim()&&!selectedItems.includes(customItem.trim())){setSelectedItems(prev=>[...prev,customItem.trim()]);setCustomItem("");}};
  const resetApp=()=>{setStep(0);setServiceType(null);setQuotes([]);setSelectedItems([]);setEventType(null);setEventDate("");setMealTime("");setDietaryPref("any");setGuestCount(100);setPerPlateBudget(500);setCustomerPincode("");setCustomerCoords(null);setSelectedQuote(null);setOrderPlaced(null);setQuotationRequest(null);setWhatsappSent([]);setDeliveryAddress({flat:"",building:"",street:"",landmark:"",pincode:"",city:"Kolkata",state:"West Bengal"});};

  if(authLoading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"var(--bg-primary)"}}><div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:12}}>🍛</div><div style={{color:"var(--text-secondary)"}}>Loading...</div></div></div>;

  return(
    <div style={S.root}>
      {import.meta.env.VITE_USE_EMULATORS==="true"&&(
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,background:"#dc2626",color:"#fff",textAlign:"center",fontSize:11,fontWeight:700,padding:"3px 0",letterSpacing:"0.1em"}}>
          LOCAL DEV — Firebase Emulators Active — Not connected to production
        </div>
      )}
      {/* Bengali border pattern top */}
      <div style={S.bengaliTopBorder}/>
      <div style={S.bgPattern}/>

      {/* ── Payment Gateway Modal ─────────────────────────────────────────── */}
      {paymentModal&&<PaymentGateway amount={paymentModal.amount} purpose={paymentModal.purpose} catererName={paymentModal.catererName} onSuccess={paymentModal.onSuccess} onCancel={()=>setPaymentModal(null)}/>}

      {/* ── Login Modal (Firebase Auth) ────────────────────────────────────── */}
      {showLogin&&(
        <div style={{position:"fixed",inset:0,zIndex:190,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{...S.card,...anim,maxWidth:400,width:"100%",textAlign:"center"}}>
            <button onClick={()=>{setShowLogin(false);setLoginError("");}} style={{position:"absolute",top:12,right:16,background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#9ca3af"}}>×</button>
            <div style={{fontSize:44,marginBottom:12}}>🔐</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#1f2937",marginBottom:6}}>{loginMode==="login"?"Welcome Back":"Create Account"}</h2>
            <p style={{fontSize:13,color:"#6b7280",marginBottom:18}}>Sign in to book caterers & place orders</p>

            {/* Google Sign-in */}
            <button onClick={handleGoogleLogin} disabled={loginLoading} style={{width:"100%",padding:"12px 16px",borderRadius:10,border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontSize:14,fontWeight:600,color:"#374151",marginBottom:16,opacity:loginLoading?0.6:1}}>
              <span style={{fontSize:20}}>🌐</span> Continue with Google
            </button>

            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <div style={{flex:1,height:1,background:"#e5e7eb"}}/>
              <span style={{fontSize:12,color:"#9ca3af"}}>or use email</span>
              <div style={{flex:1,height:1,background:"#e5e7eb"}}/>
            </div>

            {/* Email/Password */}
            {loginMode==="signup"&&<input type="text" placeholder="Full Name" value={loginName} onChange={e=>setLoginName(e.target.value)} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #e5e7eb",marginBottom:10,fontSize:14,outline:"none",boxSizing:"border-box"}}/>}
            <input type="email" placeholder="Email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #e5e7eb",marginBottom:10,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            <input type="password" placeholder="Password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleEmailAuth()} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #e5e7eb",marginBottom:10,fontSize:14,outline:"none",boxSizing:"border-box"}}/>

            {loginError&&<div style={{color:"#ef4444",fontSize:12,marginBottom:8,textAlign:"left"}}>{loginError}</div>}

            <button onClick={handleEmailAuth} disabled={loginLoading} style={{...S.primaryBtn,width:"100%",opacity:loginLoading?0.6:1}}>
              {loginLoading?"Please wait...":loginMode==="login"?"Sign In →":"Create Account →"}
            </button>

            <div style={{marginTop:14,fontSize:13}}>
              {loginMode==="login"
                ?<span style={{color:"#6b7280"}}>New here? <button onClick={()=>{setLoginMode("signup");setLoginError("");}} style={{background:"none",border:"none",color:"#c0392b",cursor:"pointer",fontWeight:600,fontSize:13}}>Sign Up</button></span>
                :<span style={{color:"#6b7280"}}>Have an account? <button onClick={()=>{setLoginMode("login");setLoginError("");}} style={{background:"none",border:"none",color:"#c0392b",cursor:"pointer",fontWeight:600,fontSize:13}}>Sign In</button></span>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Preferences Onboarding Modal ──────────────────────────────────── */}
      {showPreferences&&user&&(
        <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflowY:"auto"}}>
          <div style={{...S.card,...anim,maxWidth:480,width:"100%",maxHeight:"90vh",overflowY:"auto",padding:28}}>
            <button onClick={()=>setShowPreferences(false)} style={{position:"absolute",top:12,right:16,background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#9ca3af"}}>×</button>

            {/* Header */}
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:44,marginBottom:8}}>{["🍽️","🥘","✨"][prefStep]}</div>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#1f2937",marginBottom:4}}>
                {prefStep===0?"Your Food Preferences":prefStep===1?"Favourite Cuisines":"Almost Done!"}
              </h2>
              <p style={{fontSize:13,color:"#6b7280"}}>
                {prefStep===0?"Help us personalise your catering experience":prefStep===1?"Select cuisines you love (pick multiple)":"Budget & event preferences"}
              </p>
              {/* Step indicator */}
              <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:12}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{width:i===prefStep?28:10,height:6,borderRadius:3,background:i<=prefStep?"#c0392b":"#e5e7eb",transition:"all 0.3s ease"}}/>
                ))}
              </div>
            </div>

            {/* Step 0: Dietary Preference + Spice Level */}
            {prefStep===0&&(
              <div>
                <label style={{fontSize:13,fontWeight:600,color:"#374151",marginBottom:8,display:"block"}}>🥗 Dietary Preference</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:18}}>
                  {[{id:"non-veg",label:"Non-Vegetarian",icon:"🍗"},{id:"veg",label:"Vegetarian",icon:"🥬"},{id:"vegan",label:"Vegan",icon:"🌱"},{id:"eggetarian",label:"Eggetarian",icon:"🥚"}].map(d=>(
                    <button key={d.id} onClick={()=>setPrefData(p=>({...p,dietary:d.id}))} style={{padding:"14px 12px",borderRadius:12,border:`2px solid ${prefData.dietary===d.id?"#c0392b":"#e5e7eb"}`,background:prefData.dietary===d.id?"#fff5f5":"#fff",cursor:"pointer",textAlign:"center",transition:"all 0.2s"}}>
                      <div style={{fontSize:24,marginBottom:4}}>{d.icon}</div>
                      <div style={{fontSize:13,fontWeight:prefData.dietary===d.id?700:500,color:prefData.dietary===d.id?"#c0392b":"#374151"}}>{d.label}</div>
                    </button>
                  ))}
                </div>

                <label style={{fontSize:13,fontWeight:600,color:"#374151",marginBottom:8,display:"block"}}>🌶️ Spice Level</label>
                <div style={{display:"flex",gap:8}}>
                  {[{id:"mild",label:"Mild",icon:"😊"},{id:"medium",label:"Medium",icon:"😋"},{id:"spicy",label:"Spicy",icon:"🥵"},{id:"extra-spicy",label:"Extra Spicy",icon:"🔥"}].map(s=>(
                    <button key={s.id} onClick={()=>setPrefData(p=>({...p,spiceLevel:s.id}))} style={{flex:1,padding:"10px 6px",borderRadius:10,border:`2px solid ${prefData.spiceLevel===s.id?"#c0392b":"#e5e7eb"}`,background:prefData.spiceLevel===s.id?"#fff5f5":"#fff",cursor:"pointer",textAlign:"center",transition:"all 0.2s"}}>
                      <div style={{fontSize:20}}>{s.icon}</div>
                      <div style={{fontSize:11,fontWeight:prefData.spiceLevel===s.id?700:500,color:prefData.spiceLevel===s.id?"#c0392b":"#374151",marginTop:2}}>{s.label}</div>
                    </button>
                  ))}
                </div>

                <label style={{fontSize:13,fontWeight:600,color:"#374151",marginBottom:8,display:"block",marginTop:18}}>⚠️ Allergies (optional)</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {["Nuts","Dairy","Gluten","Shellfish","Soy","Eggs","None"].map(a=>(
                    <button key={a} onClick={()=>{if(a==="None")setPrefData(p=>({...p,allergies:[]}));else togglePrefArray("allergies",a);}} style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${(a==="None"&&prefData.allergies.length===0)||prefData.allergies.includes(a)?"#c0392b":"#e5e7eb"}`,background:(a==="None"&&prefData.allergies.length===0)||prefData.allergies.includes(a)?"#fff5f5":"#fff",cursor:"pointer",fontSize:12,fontWeight:500,color:(a==="None"&&prefData.allergies.length===0)||prefData.allergies.includes(a)?"#c0392b":"#6b7280",transition:"all 0.2s"}}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1: Cuisine Selection */}
            {prefStep===1&&(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {ALL_CUISINES.map(c=>(
                    <button key={c} onClick={()=>togglePrefArray("cuisines",c)} style={{padding:"12px 14px",borderRadius:10,border:`2px solid ${prefData.cuisines.includes(c)?"#c0392b":"#e5e7eb"}`,background:prefData.cuisines.includes(c)?"#fff5f5":"#fff",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:8,transition:"all 0.2s"}}>
                      <span style={{fontSize:16}}>{prefData.cuisines.includes(c)?"✅":"○"}</span>
                      <span style={{fontSize:13,fontWeight:prefData.cuisines.includes(c)?700:500,color:prefData.cuisines.includes(c)?"#c0392b":"#374151"}}>{c}</span>
                    </button>
                  ))}
                </div>
                {prefData.cuisines.length===0&&<p style={{fontSize:12,color:"#9ca3af",marginTop:10,textAlign:"center"}}>Select at least one cuisine to continue</p>}
              </div>
            )}

            {/* Step 2: Budget & Event Type */}
            {prefStep===2&&(
              <div>
                <label style={{fontSize:13,fontWeight:600,color:"#374151",marginBottom:8,display:"block"}}>💰 Typical Budget per Plate</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:18}}>
                  {[{id:"budget",label:"Budget-Friendly",sub:"₹120–₹350",icon:"💵"},{id:"moderate",label:"Moderate",sub:"₹350–₹600",icon:"💰"},{id:"premium",label:"Premium",sub:"₹600–₹1000",icon:"💎"},{id:"luxury",label:"Luxury",sub:"₹1000+",icon:"👑"}].map(b=>(
                    <button key={b.id} onClick={()=>setPrefData(p=>({...p,budgetRange:b.id}))} style={{padding:"14px 10px",borderRadius:12,border:`2px solid ${prefData.budgetRange===b.id?"#c0392b":"#e5e7eb"}`,background:prefData.budgetRange===b.id?"#fff5f5":"#fff",cursor:"pointer",textAlign:"center",transition:"all 0.2s"}}>
                      <div style={{fontSize:22,marginBottom:2}}>{b.icon}</div>
                      <div style={{fontSize:13,fontWeight:prefData.budgetRange===b.id?700:500,color:prefData.budgetRange===b.id?"#c0392b":"#374151"}}>{b.label}</div>
                      <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{b.sub}</div>
                    </button>
                  ))}
                </div>

                <label style={{fontSize:13,fontWeight:600,color:"#374151",marginBottom:8,display:"block"}}>👥 Typical Guest Count</label>
                <div style={{display:"flex",gap:8,marginBottom:18}}>
                  {[{id:"1-30",label:"1–30"},{id:"30-100",label:"30–100"},{id:"100-300",label:"100–300"},{id:"300+",label:"300+"}].map(g=>(
                    <button key={g.id} onClick={()=>setPrefData(p=>({...p,guestSizePreference:g.id}))} style={{flex:1,padding:"10px 6px",borderRadius:10,border:`2px solid ${prefData.guestSizePreference===g.id?"#c0392b":"#e5e7eb"}`,background:prefData.guestSizePreference===g.id?"#fff5f5":"#fff",cursor:"pointer",fontSize:13,fontWeight:prefData.guestSizePreference===g.id?700:500,color:prefData.guestSizePreference===g.id?"#c0392b":"#374151",transition:"all 0.2s"}}>
                      {g.label}
                    </button>
                  ))}
                </div>

                <label style={{fontSize:13,fontWeight:600,color:"#374151",marginBottom:8,display:"block"}}>🎊 Event Types You Usually Host</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {EVENT_TYPES.map(e=>(
                    <button key={e.id} onClick={()=>togglePrefArray("favoriteEventTypes",e.id)} style={{padding:"8px 16px",borderRadius:20,border:`1.5px solid ${prefData.favoriteEventTypes.includes(e.id)?"#c0392b":"#e5e7eb"}`,background:prefData.favoriteEventTypes.includes(e.id)?"#fff5f5":"#fff",cursor:"pointer",fontSize:12,fontWeight:500,display:"flex",alignItems:"center",gap:6,color:prefData.favoriteEventTypes.includes(e.id)?"#c0392b":"#6b7280",transition:"all 0.2s"}}>
                      <span>{e.icon}</span>{e.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div style={{display:"flex",gap:10,marginTop:24}}>
              {prefStep>0&&(
                <button onClick={()=>setPrefStep(s=>s-1)} style={{...S.ghostBtn,flex:1,padding:"12px 0"}}>← Back</button>
              )}
              {prefStep<2?(
                <button onClick={()=>setPrefStep(s=>s+1)} disabled={prefStep===1&&prefData.cuisines.length===0} style={{...S.primaryBtn,flex:1,opacity:prefStep===1&&prefData.cuisines.length===0?0.5:1}}>
                  Next →
                </button>
              ):(
                <button onClick={handleSavePreferences} disabled={prefSaving} style={{...S.primaryBtn,flex:1,opacity:prefSaving?0.6:1}}>
                  {prefSaving?"Saving...":"🎉 Save & Start Exploring"}
                </button>
              )}
            </div>
            <button onClick={()=>setShowPreferences(false)} style={{background:"none",border:"none",color:"#9ca3af",fontSize:12,cursor:"pointer",marginTop:10,display:"block",textAlign:"center",width:"100%"}}>Skip for now</button>
          </div>
        </div>
      )}

      {/* ── Scrolling Announcement Ticker ──────────────────────────────── */}
      <div style={{background:"linear-gradient(90deg,#E8760A,#C95F08)",padding:"8px 0",overflow:"hidden",position:"relative"}}>
        <div style={{display:"flex",animation:"scrollRibbon 20s linear infinite",whiteSpace:"nowrap"}}>
          {[...Array(2)].map((_,i)=>(
            <div key={i} style={{display:"flex",gap:40,paddingRight:40}}>
              <span style={{fontSize:12,color:"#fff",fontWeight:600}}>📍 Serving all over Kolkata</span>
              <span style={{fontSize:12,color:"#FDE68A",fontWeight:700}}>🟢 Live · 15+ Verified Kitchens</span>
              <span style={{fontSize:12,color:"#fff",fontWeight:600}}>⚡ Free quotes in 48 hours</span>
              <span style={{fontSize:12,color:"#FDE68A",fontWeight:700}}>🚀 Now Onboarding Partner Caterers!</span>
              <span style={{fontSize:12,color:"#fff",fontWeight:600}}>🎉 Food Tasting from ₹199</span>
              <span style={{fontSize:12,color:"#FDE68A",fontWeight:700}}>💰 Just 3% commission — not up to 30%</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="header-wrap" style={S.header}>
        <button onClick={()=>{navigate("landing");resetApp();}} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:10}}>
          <img src="/logo-aayojan-compact.svg" alt="Aayojan" style={{width:42,height:42,borderRadius:12}}/>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#E8760A"}}>Aayojan</div>
            <div style={{fontSize:10,color:"#7B634E",marginTop:1}}>📍 all over Kolkata</div>
          </div>
        </button>
        <div className="header-right" style={{display:"flex",alignItems:"center",gap:8}}>
          <button className="theme-toggle" onClick={()=>setDarkMode(!darkMode)} title={darkMode?"Switch to light mode":"Switch to dark mode"}>{darkMode?"☀️":"🌙"}</button>
          {view!=="landing"&&<button onClick={()=>navigate("landing")} style={S.ghostBtn}>← Home</button>}
          <button onClick={()=>navigate("about")} style={S.ghostBtn}>About Us</button>
          <button onClick={()=>navigate("chat")} style={{...S.ghostBtn,borderColor:"rgba(232,118,10,0.4)",color:"#F3C869",background:"rgba(232,118,10,0.1)"}}>💬 Hey Partner, Chat with us</button>
          {user?.isAdmin&&<button onClick={()=>{loadAdminData();navigate("admin");}} style={{...S.ghostBtn,borderColor:"#bbf7d0",color:"#16a34a",background:"#f0fdf4"}}>👑 Admin</button>}
          {user?<div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={openProfile} style={{display:"flex",alignItems:"center",gap:5,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#16a34a",cursor:"pointer"}}>
              {user.photoURL?<img src={user.photoURL} alt="" style={{width:20,height:20,borderRadius:"50%"}}/>:<span>👤</span>}
              {user.displayName||user.email}
            </button>
            <button onClick={logout} style={{background:"none",border:"1px solid #fca5a5",borderRadius:8,padding:"6px 10px",fontSize:11,color:"#c0392b",cursor:"pointer"}}>Logout</button>
          </div>:<button onClick={()=>setShowLogin(true)} style={{...S.primaryBtn,padding:"8px 16px",width:"auto",marginTop:0}}>Login</button>}
        </div>
        <button className="hamburger-btn" onClick={()=>setMenuOpen(o=>!o)} aria-label="Menu" aria-expanded={menuOpen} style={{display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:"1px solid var(--border-default)",borderRadius:10,padding:"10px 11px",cursor:"pointer",color:"var(--text-primary)"}}><span className={"hb"+(menuOpen?" open":"")}><i/><i/><i/></span></button>
      </header>
      {menuOpen&&(<>
        <div onClick={()=>setMenuOpen(false)} style={{position:"fixed",inset:0,zIndex:150}}/>
        <div className="mobile-menu" style={{position:"fixed",top:62,right:12,zIndex:200,width:"min(264px,92vw)",background:"var(--bg-card,#fff)",border:"1px solid var(--border-default)",borderRadius:14,padding:8,display:"flex",flexDirection:"column",gap:2,boxShadow:"0 22px 54px rgba(0,0,0,0.28)"}}>
          <button onClick={()=>{navigate("landing");resetApp();setMenuOpen(false);}} style={{textAlign:"left",padding:"10px 12px",borderRadius:9,fontSize:14.5,fontWeight:600,color:"var(--text-primary)",background:"none",border:"none",cursor:"pointer"}}>🏠 Home</button>
          <a href="/events/" style={{padding:"10px 12px",borderRadius:9,fontSize:14.5,fontWeight:600,color:"var(--text-primary)"}}>🎉 Events</a>
          <a href="/caterers/" style={{padding:"10px 12px",borderRadius:9,fontSize:14.5,fontWeight:600,color:"var(--text-primary)"}}>📍 Areas we serve</a>
          <a href="/partners.html" style={{padding:"10px 12px",borderRadius:9,fontSize:14.5,fontWeight:800,color:"#E8760A",background:"rgba(232,118,10,0.10)"}}>🍳 For Caterers — Join Free</a>
          <a href="/faq.html" style={{padding:"10px 12px",borderRadius:9,fontSize:14.5,fontWeight:600,color:"var(--text-primary)"}}>❓ FAQ</a>
          <div style={{height:1,background:"var(--border-light)",margin:"4px 6px"}}/>
          <button onClick={()=>{navigate("about");setMenuOpen(false);}} style={{textAlign:"left",padding:"10px 12px",borderRadius:9,fontSize:14.5,fontWeight:600,color:"var(--text-secondary)",background:"none",border:"none",cursor:"pointer"}}>ℹ️ About Us</button>
          <button onClick={()=>{navigate("chat");setMenuOpen(false);}} style={{textAlign:"left",padding:"10px 12px",borderRadius:9,fontSize:14.5,fontWeight:600,color:"var(--text-secondary)",background:"none",border:"none",cursor:"pointer"}}>💬 Chat with us</button>
          <button onClick={()=>setDarkMode(!darkMode)} style={{textAlign:"left",padding:"10px 12px",borderRadius:9,fontSize:14.5,fontWeight:600,color:"var(--text-secondary)",background:"none",border:"none",cursor:"pointer"}}>{darkMode?"☀️ Light mode":"🌙 Dark mode"}</button>
          {user?<button onClick={()=>{logout();setMenuOpen(false);}} style={{textAlign:"left",padding:"10px 12px",borderRadius:9,fontSize:14.5,fontWeight:600,color:"#c0392b",background:"none",border:"none",cursor:"pointer"}}>↩ Logout</button>:<button onClick={()=>{setShowLogin(true);setMenuOpen(false);}} style={{textAlign:"center",padding:"11px 12px",marginTop:2,borderRadius:9,fontSize:14.5,fontWeight:800,color:"#fff",background:"#E8760A",border:"none",cursor:"pointer"}}>Login</button>}
        </div>
      </>)}

      {/* ══════════════════════════════════════════════════════════════════════
          LANDING
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="landing"&&(
        <div style={{...anim,overflowX:"hidden"}}>

         {/* ── HERO SECTION — Two-door marketplace split ────────────────── */}
         <div className="landing-hero" style={{position:"relative",minHeight:"86vh",overflow:"hidden",background:"linear-gradient(180deg,#0F0A05 0%,#1A1208 50%,#2A1C0F 100%)"}}>

           {/* Floating saffron glows — cinematic depth */}
           <div style={{position:"absolute",top:"-220px",left:"22%",width:620,height:620,background:"radial-gradient(circle,rgba(232,118,10,0.22) 0%,transparent 60%)",pointerEvents:"none",animation:"heroGlowA 14s ease-in-out infinite"}}/>
           <div style={{position:"absolute",bottom:"-200px",right:"15%",width:540,height:540,background:"radial-gradient(circle,rgba(243,200,105,0.16) 0%,transparent 60%)",pointerEvents:"none",animation:"heroGlowB 18s ease-in-out infinite"}}/>

           {/* Hairline grid overlay */}
           <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(243,200,105,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(243,200,105,0.03) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none"}}/>

           {/* Top center brand strip */}
           <div style={{position:"absolute",top:24,left:0,right:0,textAlign:"center",zIndex:3}}>
             <div style={{display:"inline-flex",alignItems:"center",gap:12,padding:"6px 16px",border:"1px solid rgba(243,200,105,0.25)",borderRadius:99,background:"rgba(0,0,0,0.4)"}}>
               <span style={{width:6,height:6,borderRadius:"50%",background:"#86efac",boxShadow:"0 0 10px #86efac",animation:"heroPulseDot 1.8s infinite"}}/>
               <span style={{fontFamily:"'Playfair Display',serif",fontSize:11,fontWeight:800,color:"#F3C869",letterSpacing:"0.28em",textTransform:"uppercase"}}>· The Aayojan Marketplace ·</span>
             </div>
           </div>

           {/* Two-column split */}
           <div className="hero-split" style={{position:"relative",zIndex:2,display:"grid",gridTemplateColumns:"1fr 1fr",minHeight:"86vh",paddingBottom:60}}>

             {/* ════════ LEFT — FOR CATERERS ════════ */}
             <div style={{padding:"100px 5% 60px 7%",display:"flex",flexDirection:"column",justifyContent:"center",borderRight:"1px solid rgba(243,200,105,0.18)",background:"linear-gradient(135deg,rgba(232,118,10,0.06) 0%,transparent 60%)",position:"relative"}}>

               {/* Side eyebrow */}
               <div style={{display:"inline-flex",alignSelf:"flex-start",alignItems:"center",gap:8,background:"rgba(232,118,10,0.14)",border:"1px solid rgba(232,118,10,0.35)",borderRadius:99,padding:"6px 14px",marginBottom:24}}>
                 <span style={{fontSize:14}}>🍳</span>
                 <span style={{fontSize:10,fontWeight:800,color:"#FBBF77",letterSpacing:"0.22em",textTransform:"uppercase"}}>For Caterers</span>
               </div>

               {/* Headline */}
               <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(34px,5.5vw,56px)",fontWeight:900,lineHeight:1.03,color:"#FFF8EF",letterSpacing:"-0.02em",margin:"0 0 18px"}}>
                 Cook.<br/>Quote.<br/><em style={{fontStyle:"italic",fontWeight:600,color:"#F3C869"}}>Get paid.</em>
               </h2>

               {/* Subtitle */}
               <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"clamp(16px,1.9vw,21px)",color:"rgba(255,248,239,0.75)",margin:"0 0 30px",lineHeight:1.55,maxWidth:440,fontWeight:500}}>
                 Verified event leads on WhatsApp as we onboard customers. No app, no dashboard, no monthly fee. 3% commission only when you earn. Launch offer: early partners pay 0% for the first year.
               </p>

               {/* CTA */}
               <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:26}}>
                 <a href="/partners.html" style={{display:"inline-flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#E8760A,#C95F08)",color:"#FFF8EF",padding:"14px 26px",borderRadius:99,fontSize:14,fontWeight:800,textDecoration:"none",boxShadow:"0 12px 32px rgba(232,118,10,0.45)",fontFamily:"'Playfair Display',serif"}}>🏅 Become a Founding Partner →</a>
               </div>

               {/* Trust strip */}
               <div style={{display:"flex",gap:20,flexWrap:"wrap",fontSize:11,color:"rgba(255,248,239,0.55)"}}>
                 <div><strong style={{color:"#F3C869",fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:900,display:"block"}}>₹0</strong> to join</div>
                 <div><strong style={{color:"#F3C869",fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:900,display:"block"}}>3%</strong> only when you earn</div>
                 <div><strong style={{color:"#F3C869",fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:900,display:"block"}}>WhatsApp</strong> direct leads</div>
               </div>

             </div>

             {/* ════════ RIGHT — FOR AAYOJAKS ════════ */}
             <div style={{padding:"100px 7% 60px 5%",display:"flex",flexDirection:"column",justifyContent:"center",background:"linear-gradient(225deg,rgba(243,200,105,0.08) 0%,transparent 60%)",position:"relative"}}>

               {/* Side eyebrow */}
               <div style={{display:"inline-flex",alignSelf:"flex-start",alignItems:"center",gap:8,background:"rgba(243,200,105,0.14)",border:"1px solid rgba(243,200,105,0.4)",borderRadius:99,padding:"6px 14px",marginBottom:24}}>
                 <span style={{fontSize:14}}>📱</span>
                 <span style={{fontSize:10,fontWeight:800,color:"#F3C869",letterSpacing:"0.22em",textTransform:"uppercase"}}>For Aayojaks</span>
               </div>

               {/* Headline with rotating word */}
               <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(34px,5.5vw,56px)",fontWeight:900,lineHeight:1.03,color:"#FFF8EF",letterSpacing:"-0.02em",margin:"0 0 18px"}}>
                 The food your<br/>
                 <span style={{
                   display:"inline-block",
                   minWidth:"min(7ch,80vw)",
                   fontStyle:"italic",
                   fontWeight:600,
                   color:HERO_WORDS[heroIdx].accent,
                   textShadow:"0 0 32px rgba(243,200,105,0.4)",
                   opacity:heroFade?0:1,
                   transform:heroFade?"translateY(8px)":"translateY(0)",
                   transition:"opacity 0.32s ease, transform 0.32s ease",
                   position:"relative",
                   padding:"0 0.1em",
                 }}>
                   {HERO_WORDS[heroIdx].word}
                   <span style={{position:"absolute",left:"50%",bottom:"-4px",transform:"translateX(-50%)",width:"60%",height:2,background:"linear-gradient(90deg,transparent,#F3C869,transparent)",opacity:0.5}}/>
                 </span>
                 <br/>will remember.
               </h2>

               {/* Subtitle */}
               <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"clamp(16px,1.9vw,21px)",color:"rgba(255,248,239,0.75)",margin:"0 0 30px",lineHeight:1.55,maxWidth:440,fontWeight:500}}>
                 Bengali-led kitchens — curated, not crowd-sourced. Tell us once, our AI matches you. all over Kolkata.
               </p>

               {/* Jamai Sasthi seasonal promo — consistent with /events */}
               <a href="/events/" style={{display:"block",maxWidth:440,margin:"0 0 22px",background:"linear-gradient(135deg,rgba(243,200,105,0.18),rgba(232,118,10,0.16))",border:"1.5px solid rgba(243,200,105,0.5)",borderRadius:14,padding:"12px 16px",textDecoration:"none",boxShadow:"0 10px 30px rgba(232,118,10,0.25)"}}>
                 <div style={{fontFamily:"'Playfair Display',serif",fontWeight:800,color:"#FFE9B0",fontSize:15,marginBottom:3}}>🎣 শুভ জামাই ষষ্ঠী · Jamai Sasthi · 20–21 June</div>
                 <div style={{fontSize:12.5,color:"rgba(255,248,239,0.88)",lineHeight:1.4}}>Treat your jamai to a lavish feast — from <strong style={{color:"#FFE9B0"}}>₹500/plate</strong>. Order before 18 June →</div>
               </a>

               {/* CTA — route every order into the /events AI planner funnel */}
               <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:26}}>
                 <a href="/events/" style={{display:"inline-flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#F3C869,#E8760A)",color:"#0F0A05",padding:"14px 26px",borderRadius:99,fontSize:14,fontWeight:800,textDecoration:"none",boxShadow:"0 12px 32px rgba(243,200,105,0.4)",fontFamily:"'Playfair Display',serif"}}>✨ Plan with Aayojan AI →</a>
               </div>

               {/* Trust strip */}
               <div style={{display:"flex",gap:20,flexWrap:"wrap",fontSize:11,color:"rgba(255,248,239,0.55)"}}>
                 <div><strong style={{color:"#F3C869",fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:900,display:"block"}}>4h</strong> first quote</div>
                 <div><strong style={{color:"#F3C869",fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:900,display:"block"}}>₹0</strong> to use</div>
                 <div><strong style={{color:"#F3C869",fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:900,display:"block"}}>100%</strong> Bengali-led</div>
               </div>

             </div>

             {/* Center marketplace medallion */}
             <div className="hero-medallion" style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:4,pointerEvents:"none"}}>
               <div style={{width:78,height:78,borderRadius:"50%",background:"linear-gradient(135deg,#0F0A05,#2A1C0F)",border:"2px solid #F3C869",display:"grid",placeItems:"center",boxShadow:"0 0 0 8px rgba(15,10,5,1), 0 0 40px rgba(243,200,105,0.4)",position:"relative"}}>
                 <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:900,color:"#F3C869",letterSpacing:"0.08em",lineHeight:1,textAlign:"center"}}>আ<br/><span style={{fontSize:8,letterSpacing:"0.2em",fontWeight:700}}>AAYOJAN</span></div>
               </div>
             </div>
           </div>

           {/* Bottom activity ticker — full width, the live magic */}
           <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"14px 0",background:"rgba(0,0,0,0.55)",borderTop:"1px solid rgba(243,200,105,0.18)",overflow:"hidden",zIndex:3}}>
             <div style={{display:"flex",alignItems:"center",gap:14,padding:"0 16px"}}>
               <div style={{flexShrink:0,fontSize:9,fontWeight:800,color:"#F3C869",letterSpacing:"0.18em",padding:"4px 10px",border:"1px solid rgba(243,200,105,0.4)",borderRadius:4}}>RECENT</div>
               <div style={{flex:1,overflow:"hidden",position:"relative",maskImage:"linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)",WebkitMaskImage:"linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)"}}>
                 <div style={{display:"flex",gap:48,whiteSpace:"nowrap",animation:"heroTicker 45s linear infinite",width:"max-content"}}>
                   {[...TICKER,...TICKER,...TICKER].map((line,i)=>(
                     <span key={i} style={{fontSize:13,color:"rgba(255,248,239,0.72)",fontWeight:500,fontFamily:"'DM Sans',sans-serif"}}>{line}</span>
                   ))}
                 </div>
               </div>
             </div>
           </div>
         </div>

         {/* ── BROWSE STRIP — Internal links for SEO + UX ────────────────
             Critical: every link below is rendered as static <a href>
             so Googlebot can crawl the link graph and stop seeing
             our area/event/cuisine pages as orphans.
             ───────────────────────────────────────────────────────────── */}
         <div style={{background:"linear-gradient(180deg,#FFF8EF 0%,#FFFAEF 100%)",borderTop:"1px solid #EDD8BC",padding:"38px 5% 32px"}}>
           <div style={{maxWidth:1120,margin:"0 auto"}}>
             <div style={{textAlign:"center",marginBottom:24}}>
               <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:14,color:"#C95F08",letterSpacing:"0.04em",marginBottom:4}}>Already know what you're looking for?</div>
               <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(20px,3vw,28px)",fontWeight:800,color:"#1C130A",margin:0,letterSpacing:"-0.01em"}}>Browse Aayojan <em style={{color:"#E8760A",fontStyle:"italic"}}>directly</em>.</h2>
             </div>

             <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}} className="browse-strip">

               {/* By Area */}
               <div style={{background:"white",border:"1px solid #EDD8BC",borderRadius:14,padding:"18px 18px"}}>
                 <div style={{fontSize:11,fontWeight:800,letterSpacing:"0.16em",color:"#C95F08",textTransform:"uppercase",marginBottom:10,display:"flex",alignItems:"center",gap:6}}><span>📍</span>By area</div>
                 <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                   <a href="/caterers/newtown.html" style={{background:"#FDF6ED",border:"1px solid #EDD8BC",padding:"5px 11px",borderRadius:99,fontSize:12,color:"#4A2C0A",fontWeight:600,textDecoration:"none"}}>Newtown</a>
                   <a href="/caterers/salt-lake.html" style={{background:"#FDF6ED",border:"1px solid #EDD8BC",padding:"5px 11px",borderRadius:99,fontSize:12,color:"#4A2C0A",fontWeight:600,textDecoration:"none"}}>Salt Lake</a>
                   <a href="/caterers/rajarhat.html" style={{background:"#FDF6ED",border:"1px solid #EDD8BC",padding:"5px 11px",borderRadius:99,fontSize:12,color:"#4A2C0A",fontWeight:600,textDecoration:"none"}}>Rajarhat</a>
                 </div>
                 <a href="/caterers/" style={{fontSize:12,color:"#E8760A",fontWeight:700,textDecoration:"none",borderBottom:"1px solid rgba(232,118,10,0.35)",paddingBottom:1}}>See all areas →</a>
               </div>

               {/* By Event */}
               <div style={{background:"white",border:"1px solid #EDD8BC",borderRadius:14,padding:"18px 18px"}}>
                 <div style={{fontSize:11,fontWeight:800,letterSpacing:"0.16em",color:"#C95F08",textTransform:"uppercase",marginBottom:10,display:"flex",alignItems:"center",gap:6}}><span>🎉</span>By event</div>
                 <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                   <a href="/events/wedding-caterer-newtown.html" style={{background:"#FDF6ED",border:"1px solid #EDD8BC",padding:"5px 11px",borderRadius:99,fontSize:12,color:"#4A2C0A",fontWeight:600,textDecoration:"none"}}>💍 Wedding</a>
                   <a href="/events/annaprasan-caterer-kolkata.html" style={{background:"#FDF6ED",border:"1px solid #EDD8BC",padding:"5px 11px",borderRadius:99,fontSize:12,color:"#4A2C0A",fontWeight:600,textDecoration:"none"}}>🍚 Annaprasan</a>
                   <a href="/events/bhai-phota-catering-kolkata.html" style={{background:"#FDF6ED",border:"1px solid #EDD8BC",padding:"5px 11px",borderRadius:99,fontSize:12,color:"#4A2C0A",fontWeight:600,textDecoration:"none"}}>🎁 Bhai Phota</a>
                   <a href="/events/corporate-lunch-salt-lake-sector-v.html" style={{background:"#FDF6ED",border:"1px solid #EDD8BC",padding:"5px 11px",borderRadius:99,fontSize:12,color:"#4A2C0A",fontWeight:600,textDecoration:"none"}}>🏢 Corporate</a>
                 </div>
                 <a href="/events/" style={{fontSize:12,color:"#E8760A",fontWeight:700,textDecoration:"none",borderBottom:"1px solid rgba(232,118,10,0.35)",paddingBottom:1}}>See all events →</a>
               </div>

               {/* By Cuisine */}
               <div style={{background:"white",border:"1px solid #EDD8BC",borderRadius:14,padding:"18px 18px"}}>
                 <div style={{fontSize:11,fontWeight:800,letterSpacing:"0.16em",color:"#C95F08",textTransform:"uppercase",marginBottom:10,display:"flex",alignItems:"center",gap:6}}><span>🍽️</span>By cuisine</div>
                 <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                   <a href="/cuisines/bengali-caterer-newtown.html" style={{background:"#FDF6ED",border:"1px solid #EDD8BC",padding:"5px 11px",borderRadius:99,fontSize:12,color:"#4A2C0A",fontWeight:600,textDecoration:"none"}}>🐟 Bengali</a>
                   <a href="/cuisines/biryani-caterer-newtown.html" style={{background:"#FDF6ED",border:"1px solid #EDD8BC",padding:"5px 11px",borderRadius:99,fontSize:12,color:"#4A2C0A",fontWeight:600,textDecoration:"none"}}>🍛 Biryani</a>
                   <a href="/cuisines/mughlai-caterer-salt-lake.html" style={{background:"#FDF6ED",border:"1px solid #EDD8BC",padding:"5px 11px",borderRadius:99,fontSize:12,color:"#4A2C0A",fontWeight:600,textDecoration:"none"}}>🍢 Mughlai</a>
                   <a href="/cuisines/multi-cuisine-caterer-kolkata.html" style={{background:"#FDF6ED",border:"1px solid #EDD8BC",padding:"5px 11px",borderRadius:99,fontSize:12,color:"#4A2C0A",fontWeight:600,textDecoration:"none"}}>🍽️ Multi-cuisine</a>
                 </div>
                 <a href="/cuisines/" style={{fontSize:12,color:"#E8760A",fontWeight:700,textDecoration:"none",borderBottom:"1px solid rgba(232,118,10,0.35)",paddingBottom:1}}>See all cuisines →</a>
               </div>

             </div>

             {/* Bengali alternate signal */}
             <div style={{textAlign:"center",marginTop:18,fontSize:12,color:"#8B6E52"}}>
               <a href="/bn/" style={{color:"#C95F08",fontWeight:700,textDecoration:"none",borderBottom:"1px solid rgba(232,118,10,0.3)",paddingBottom:1,fontFamily:"'Noto Serif Bengali',serif"}}>বাংলায় দেখুন</a>
               <span style={{margin:"0 8px",color:"#EDD8BC"}}>·</span>
               <a href="/bn/" style={{color:"#C95F08",fontWeight:600,textDecoration:"none",borderBottom:"1px solid rgba(232,118,10,0.3)",paddingBottom:1}}>View in Bengali</a>
             </div>
           </div>
         </div>

         {/* ── SECTION DIVIDER — Customer area ─────────────────────────── */}
         <div style={{textAlign:"center",padding:"32px 14px 0",position:"relative"}}>
           <div style={{width:"100%",height:1,background:"var(--border-light)",position:"absolute",top:"50%",left:0}}/>
           <span style={{position:"relative",background:"var(--bg-primary)",padding:"8px 20px",borderRadius:24,border:"1px solid var(--border-light)",fontSize:13,fontWeight:700,color:"var(--text-muted)",letterSpacing:0.5}}>👇 FOR AAYOJAKS</span>
         </div>

         {/* ── LIVE — "we're ready to serve you" teaser with food gallery ──────── */}
         <div style={{padding:"64px 14px",background:"linear-gradient(180deg,#FFF8EF 0%,#FFF0D5 60%,#FFE9C7 100%)",position:"relative",overflow:"hidden"}}>
           {/* Decorative blobs */}
           <div style={{position:"absolute",top:"-20%",left:"-10%",width:"50%",height:"60%",background:"radial-gradient(ellipse,rgba(232,118,10,0.10) 0%,transparent 60%)",pointerEvents:"none"}}></div>
           <div style={{position:"absolute",bottom:"-20%",right:"-10%",width:"50%",height:"60%",background:"radial-gradient(ellipse,rgba(243,200,105,0.18) 0%,transparent 60%)",pointerEvents:"none"}}></div>

           <div style={{maxWidth:1180,margin:"0 auto",position:"relative",zIndex:1}}>
             {/* Header */}
             <div style={{textAlign:"center",marginBottom:36}}>
               <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#E8760A,#C95F08)",color:"white",padding:"6px 16px",borderRadius:99,marginBottom:14,boxShadow:"0 8px 20px rgba(232,118,10,0.32)"}}>
                 <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#86efac",boxShadow:"0 0 0 0 rgba(134,239,172,0.7)",animation:"aayojan-pulse-dot 2s infinite"}}></span>
                 <span style={{fontSize:11,fontWeight:800,letterSpacing:"0.16em"}}>LIVE · TAKING ORDERS</span>
               </div>
               <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(28px,6vw,52px)",fontWeight:900,color:"#1C130A",margin:"0 0 12px",letterSpacing:"-0.02em",lineHeight:1.05}}>We're ready to <em style={{color:"#E8760A"}}>serve you</em>.</h2>
               <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"clamp(15px,2.2vw,20px)",color:"#513117",maxWidth:620,margin:"0 auto",lineHeight:1.5}}>The chefs, the kitchens, the city — together for all of Kolkata. Order now, get matched in minutes.</p>
             </div>

             {/* Jamai Sasthi featured poster — consistent with /events */}
             <a href="/events/" style={{display:"block",maxWidth:340,margin:"0 auto 34px",textDecoration:"none"}}>
               <img src="/events/img/promo/jamai-sasthi.jpg" alt="শুভ জামাই ষষ্ঠী · Happy Jamai Sasthi — lavish Bengali feast from ₹500, featured by Aayojan" loading="lazy" width="340" height="609" style={{width:"100%",borderRadius:16,boxShadow:"0 18px 50px rgba(76,43,10,0.3)",border:"2px solid rgba(243,200,105,0.5)",display:"block"}} />
               <div style={{textAlign:"center",marginTop:14}}><span style={{display:"inline-block",background:"#E8760A",color:"#fff",fontWeight:800,padding:"11px 24px",borderRadius:99,fontSize:14}}>✨ Plan your Jamai Sasthi feast →</span></div>
             </a>

             {/* Food gallery — uneven masonry grid for visual interest */}
             <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:12,marginBottom:36}} className="food-grid">
               {[
                 {img:"https://foodish-api.com/images/biryani/biryani1.jpg",label:"Slow-dum Biryani",cuisine:"Mughlai",note:"Long-grain rice, hand-trimmed mutton",span:"span 4",h:260},
                 {img:"https://foodish-api.com/images/butter-chicken/butter-chicken1.jpg",label:"Butter Chicken",cuisine:"North Indian",note:"Smoked tomato, fenugreek, cream",span:"span 5",h:260},
                 {img:"https://foodish-api.com/images/samosa/samosa1.jpg",label:"Samosa Chaat",cuisine:"Chaat Counter",note:"Crisp, tangy, layered",span:"span 3",h:260},
                 {img:"https://foodish-api.com/images/dosa/dosa1.jpg",label:"Masala Dosa",cuisine:"South Indian",note:"Crisp lentil crepe, golden ghee",span:"span 3",h:200},
                 {img:"https://foodish-api.com/images/rice/rice1.jpg",label:"Aromatic Pulao",cuisine:"Bengali",note:"Bay leaf, ghee, whole spices",span:"span 5",h:200},
                 {img:"https://foodish-api.com/images/dessert/dessert1.jpg",label:"Festive Sweets",cuisine:"Mishti",note:"Rosogolla, sandesh, gulab jamun",span:"span 4",h:200},
               ].map((d,i)=>(
                 <div key={i} style={{gridColumn:d.span,height:d.h,borderRadius:18,overflow:"hidden",position:"relative",boxShadow:"0 14px 32px rgba(76,43,10,0.22)",cursor:"default",transition:"transform 0.4s ease, box-shadow 0.4s ease",background:"#2B1B0C"}}
                   onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 22px 44px rgba(232,118,10,0.32)";}}
                   onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 14px 32px rgba(76,43,10,0.22)";}}>
                   <img src={d.img} alt={d.label} loading="lazy" referrerPolicy="no-referrer" style={{width:"100%",height:"100%",objectFit:"cover",display:"block",transition:"transform 0.6s ease"}} onError={e=>{e.target.style.display='none';}} />
                   <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,transparent 45%,rgba(15,10,5,0.88) 100%)",pointerEvents:"none"}}></div>
                   <div style={{position:"absolute",bottom:14,left:16,right:16,color:"white"}}>
                     <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"#F3C869",marginBottom:3}}>{d.cuisine}</div>
                     <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:700,letterSpacing:"-0.01em",lineHeight:1.1,marginBottom:3}}>{d.label}</div>
                     <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:12,color:"rgba(255,255,255,0.78)"}}>{d.note}</div>
                   </div>
                 </div>
               ))}
             </div>

             {/* Bottom CTA card */}
             <div style={{background:"linear-gradient(135deg,#0F0A05,#2B1B0C)",borderRadius:24,padding:"32px 28px",textAlign:"center",position:"relative",overflow:"hidden",boxShadow:"0 30px 60px rgba(15,10,5,0.32)"}}>
               <div style={{position:"absolute",top:"-50%",right:"-30%",width:"80%",height:"200%",background:"radial-gradient(ellipse,rgba(243,200,105,0.18) 0%,transparent 60%)",pointerEvents:"none"}}></div>
               <div style={{position:"relative",zIndex:1}}>
                 <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:15,color:"#F3C869",marginBottom:8}}>A note from the team</div>
                 <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(22px,4vw,32px)",fontWeight:800,color:"#FFF8EF",margin:"0 0 10px",lineHeight:1.2}}>We're live — get matched with a verified kitchen.</h3>
                 <p style={{fontSize:14,color:"rgba(255,248,239,0.7)",margin:"0 auto 22px",maxWidth:480,lineHeight:1.6}}>Drop your WhatsApp and we'll match you with a verified Bengali kitchen for your event. Free · no advance payment · no spam.</p>

                 <div style={{display:"flex",gap:8,maxWidth:440,margin:"0 auto",flexWrap:"wrap",justifyContent:"center"}}>
                   <input id="waitlistPhone" type="tel" placeholder="+91 XXXXXXXXXX" style={{flex:"1 1 240px",minWidth:200,padding:"13px 16px",background:"rgba(255,248,239,0.08)",border:"1px solid rgba(243,200,105,0.3)",borderRadius:11,color:"#FFF8EF",fontSize:14,outline:"none",colorScheme:"light"}} onFocus={e=>e.target.style.borderColor="#F3C869"} onBlur={e=>e.target.style.borderColor="rgba(243,200,105,0.3)"} />
                   <button onClick={async()=>{
                     const ph=document.getElementById('waitlistPhone').value.trim();
                     if(!ph||ph.replace(/\D/g,'').length<10){alert('Please enter a valid 10-digit number.');return;}
                     const btn=event.target;btn.disabled=true;btn.textContent='Saving...';
                     try{
                       const {db}=await import('./firebase');
                       const {collection,addDoc}=await import('firebase/firestore');
                       await addDoc(collection(db,'customerLeads'),{phone:ph,source:'landing_cta',status:'new',submittedAt:new Date().toISOString(),...getAttribution()});
                       track('lead_submitted',getAttributionForEvent());
                       btn.textContent='✅ We\'ll WhatsApp you shortly';
                       btn.style.background='#236B43';btn.style.color='#FFF8EF';
                       document.getElementById('waitlistPhone').value='';
                     }catch(e){btn.disabled=false;btn.textContent='Get matched →';alert('Could not save. Please try again.');}
                   }} style={{padding:"13px 22px",background:"linear-gradient(135deg,#F3C869,#E8760A)",color:"#0F0A05",border:"none",borderRadius:11,fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:"0 12px 28px rgba(232,118,10,0.42)",whiteSpace:"nowrap"}}>Get matched →</button>
                 </div>

                 <p style={{fontSize:11,color:"rgba(255,248,239,0.4)",margin:"18px 0 0",fontStyle:"italic"}}>5 cuisines · 15+ kitchens · live &amp; taking orders.</p>
               </div>
             </div>
           </div>
         </div>

         {/* ── EDITORIAL FEATURE — rotating spotlight (all founding partners) ─ */}
         <FeaturedSpotlight />


         {/* ── PARTNER CATERERS — Scrolling ribbon ────────────────────────── */}
         <div style={{padding:"40px 14px",background:"var(--bg-secondary)",overflow:"hidden"}}>
           <div style={{textAlign:"center",marginBottom:20}}>
             <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"var(--text-primary)"}}>Our Partner Caterers</h2>
             <p style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>15+ kitchens across Kolkata</p>
           </div>
           <div className="caterer-scroll" style={{display:"flex",gap:16,paddingBottom:12,animation:"scrollRibbon 30s linear infinite",width:"max-content"}}>
             {[...allCaterers.slice(0,7),...allCaterers.slice(0,7)].map((c,idx)=>(
               <div key={`${c.id}-${idx}`} style={{minWidth:150,background:"var(--bg-card)",border:"1px solid var(--border-light)",borderRadius:16,padding:"20px 16px",textAlign:"center",transition:"transform 0.2s",flexShrink:0}}>
                 <div style={{width:48,height:48,borderRadius:"50%",background:"var(--bg-accent-light)",border:"2px solid var(--border-accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 10px"}}>{c.logo}</div>
                 <div style={{fontSize:12,fontWeight:700,color:"var(--text-primary)",marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name.split(" ").slice(0,2).join(" ")}</div>
                 <div style={{fontSize:11,color:"var(--text-accent)",fontWeight:600}}>⭐ {c.rating}</div>
                 <div style={{fontSize:10,color:"var(--text-muted)",marginTop:3}}>{c.cuisineSpecialties?.[0]}</div>
               </div>
             ))}
           </div>
         </div>

         {/* ── FOR CATERERS — Partner appeal section ─────────────────────── */}
         <div style={{padding:"48px 14px",background:"linear-gradient(135deg,#FDF6ED 0%,#FFF0D5 100%)",borderTop:"1px solid #EDD8BC",borderBottom:"1px solid #EDD8BC"}}>
           <div style={{maxWidth:820,margin:"0 auto"}}>
             <div style={{textAlign:"center",marginBottom:28}}>
               <div style={{display:"inline-block",background:"rgba(232,118,10,0.1)",border:"1px solid rgba(232,118,10,0.2)",borderRadius:24,padding:"5px 14px",marginBottom:12}}>
                 <span style={{fontSize:12,fontWeight:700,color:"#C95F08",letterSpacing:1}}>🔥 FOUNDING PARTNER PROGRAM</span>
               </div>
               <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(22px,5vw,32px)",fontWeight:800,color:"#1C130A",marginBottom:8}}>Are you a caterer in Kolkata?</h2>
               <p style={{fontSize:14,color:"#7B634E",maxWidth:520,margin:"0 auto",lineHeight:1.7}}>Stop waiting for referrals. Get verified event leads on WhatsApp — with guest count, budget & menu preference already filled in.</p>
             </div>

             <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}} className="feat-grid">
               {[
                 {icon:"💰",title:"₹0 to join",sub:"Free forever for founding partners"},
                 {icon:"📲",title:"Leads on WhatsApp",sub:"No app, no dashboard — just real enquiries"},
                 {icon:"🏅",title:"0% first year",sub:"Early-partner pricing + lead priority"},
               ].map((b,i)=>(
                 <div key={i} style={{background:"rgba(255,255,255,0.9)",border:"1px solid #EDD8BC",borderRadius:16,padding:"18px 14px",textAlign:"center"}}>
                   <div style={{fontSize:28,marginBottom:6}}>{b.icon}</div>
                   <div style={{fontSize:13,fontWeight:700,color:"#1C130A",marginBottom:3}}>{b.title}</div>
                   <div style={{fontSize:11,color:"#7B634E"}}>{b.sub}</div>
                 </div>
               ))}
             </div>

             <div style={{textAlign:"center"}}>
               <a href="/partners.html" style={{display:"inline-block",background:"linear-gradient(135deg,#E8760A,#C95F08)",color:"#fff",padding:"14px 32px",borderRadius:12,fontSize:15,fontWeight:700,textDecoration:"none",boxShadow:"0 8px 24px rgba(232,118,10,0.3)"}}>Claim Your Founding Spot →</a>
               <p style={{fontSize:12,color:"#7B634E",marginTop:10}}>You keep 97% of every booking. 3% commission only when you earn.</p>
             </div>
           </div>
         </div>

         {/* ── CUISINES — Realistic food photos ────────────────────────── */}
         <div style={{padding:"36px 14px",maxWidth:900,margin:"0 auto",textAlign:"center"}}>
           <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"var(--text-primary)",marginBottom:20}}>Popular Cuisines We Serve</h3>
           <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:14}}>
             {[
               {name:"Bengali",img:"https://images.unsplash.com/photo-1596797038530-2c107229654b?w=200&h=200&fit=crop"},
               {name:"Biryani",img:"https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=200&h=200&fit=crop"},
               {name:"Chinese",img:"https://images.unsplash.com/photo-1585032226651-759b368d7246?w=200&h=200&fit=crop"},
               {name:"North Indian",img:"https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=200&h=200&fit=crop"},
               {name:"South Indian",img:"https://images.unsplash.com/photo-1630383249896-424e482df921?w=200&h=200&fit=crop"},
               {name:"Mughlai",img:"https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=200&h=200&fit=crop"},
               {name:"Desserts",img:"https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&h=200&fit=crop"},
               {name:"Street Food",img:"https://images.unsplash.com/photo-1601050690597-df0568f70950?w=200&h=200&fit=crop"},
             ].map(c=>(
               <div key={c.name} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
                 <div style={{width:80,height:80,borderRadius:"50%",overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.1)"}}>
                   <img src={c.img} alt={c.name} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                 </div>
                 <span style={{fontSize:12,fontWeight:600,color:"var(--text-primary)"}}>{c.name}</span>
               </div>
             ))}
           </div>
           <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",marginTop:18}}>
             {[["💍","Wedding"],["🙏","Puja"],["🎂","Birthday"],["👨‍💼","Corporate"],["👶","Baby Shower"]].map(([icon,label])=>(
               <span key={label} style={{background:"var(--bg-accent-light)",border:"1px solid var(--border-accent)",borderRadius:24,padding:"7px 14px",fontSize:12,display:"flex",alignItems:"center",gap:5,fontWeight:600,color:"var(--text-secondary)"}}>
                 <span>{icon}</span>{label}
               </span>
             ))}
           </div>
         </div>

         {/* ── FOOTER ─────────────────────────────────────────────────────── */}
         <div style={{background:"var(--bg-card)",borderTop:"1px solid var(--border-light)",padding:"32px 14px",marginTop:20}}>
          <div style={{maxWidth:820,margin:"0 auto",display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:24}} className="feat-grid">
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"var(--text-primary)",marginBottom:8}}>আয়োজন</div>
              <p style={{fontSize:12,color:"var(--text-muted)",lineHeight:1.7,marginBottom:12}}>AI-powered catering platform serving all over Kolkata. Connecting you with the best caterers for every celebration.</p>
              <div style={{display:"flex",gap:12}}>
                <a href="https://wa.me/918088434425?text=Hi%20Aayojan" target="_blank" rel="noopener noreferrer" style={{fontSize:20,textDecoration:"none"}}>💬</a>
                <a href="https://instagram.com/aayojan.online" target="_blank" rel="noopener noreferrer" style={{fontSize:20,textDecoration:"none"}}>📸</a>
                <a href="mailto:aayojan1@gmail.com" style={{fontSize:20,textDecoration:"none"}}>✉️</a>
              </div>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"var(--text-primary)",marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Quick Links</div>
              <a href="/partners.html" style={{fontSize:12,color:"var(--text-muted)",marginBottom:6,display:"block",textDecoration:"none"}}>Partner with Us</a>
              <a href="/faq.html" style={{fontSize:12,color:"var(--text-muted)",marginBottom:6,display:"block",textDecoration:"none"}}>FAQ</a>
              <div onClick={()=>navigate("about")} style={{fontSize:12,color:"var(--text-muted)",marginBottom:6,display:"block",textDecoration:"none",cursor:"pointer"}}>About Us</div>
              <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:6,cursor:"pointer"}} onClick={()=>{window.location.href="/events/";}}>✨ Plan your event →</div>
              <a href="/partners.html#register" style={{fontSize:12,color:"var(--text-muted)",marginBottom:6,display:"block",textDecoration:"none"}}>Register as Caterer</a>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"var(--text-primary)",marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Areas Served</div>
              {["All over Kolkata","Newtown","Salt Lake","Rajarhat","Baguiati · VIP Road","Lake Town · Dum Dum"].map(a=>(
                <div key={a} style={{fontSize:12,color:"var(--text-muted)",marginBottom:6}}>📍 {a}</div>
              ))}
            </div>
          </div>
          <div style={{maxWidth:820,margin:"20px auto 0",paddingTop:16,borderTop:"1px solid var(--border-light)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:11,color:"var(--text-muted)"}}>© 2025 Aayojan Technologies. Made with ❤️ in Kolkata</div>
            <div style={{fontSize:10,color:"var(--text-muted)",marginTop:4,opacity:0.8}}>MSME Registered | UDYAM-WB-14-0277694 | Micro Enterprise</div>
            <div style={{display:"flex",gap:16}}>
              <span style={{fontSize:11,color:"var(--text-muted)",cursor:"pointer"}}>Privacy Policy</span>
              <span style={{fontSize:11,color:"var(--text-muted)",cursor:"pointer"}}>Terms of Service</span>
            </div>
          </div>
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
              <h2 style={{...S.sectionTitle,marginBottom:4}}>🤖 Aayojan Partner Advisor</h2>
              <p style={{color:"#6b7280",fontSize:13}}>Ask anything about joining Aayojan as a catering partner — pricing, leads, registration</p>
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
              <AayojanChatbot user={user} allCaterers={allCaterers} onOrderCreated={order=>{setChatOrderConfirmed(order);}} onLoginRequired={()=>setShowLogin(true)} onStartOrderFlow={(caterer)=>{setServiceType(caterer?.serviceTypes?.[0]||"full");setCustomerPincode("");setStep(0);navigate("app");}}/>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          REGISTRATION
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="register"&&(()=>{window.location.href="/partners.html";return null;})()}
      {false&&(
        <div style={{...S.page,...anim}}>
          <div style={{maxWidth:700,margin:"0 auto"}}>
            {!regSuccess?<>
              <div style={{textAlign:"center",marginBottom:28}}>
                <span style={{fontSize:44}}>👨‍🍳</span>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"var(--text-primary)",marginTop:10,marginBottom:6}}>Register Your Catering Business</h2>
                <p style={{fontSize:13,color:"var(--text-secondary)"}}>Join Newtown & Salt Lake's fastest-growing caterer network</p>
              </div>
              <div style={{...S.card,padding:"28px 32px"}}>

                {/* Step indicator */}
                <div style={{display:"flex",gap:6,marginBottom:20}}>
                  {["Basic Info","Services","Capacity & Pricing","Menu & Extras"].map((s,i)=>(
                    <button key={s} onClick={()=>setRegStep(i)} style={{flex:1,padding:"8px 4px",borderRadius:8,border:`1.5px solid ${regStep===i?"#c0392b":"var(--border-default)"}`,background:regStep===i?"#c0392b":i<regStep?"var(--bg-green-light)":"var(--bg-card)",color:regStep===i?"#fff":i<regStep?"#16a34a":"var(--text-secondary)",fontSize:11,fontWeight:regStep===i?700:500,cursor:"pointer",transition:"all 0.2s"}}>
                      {i<regStep?"✓ ":""}{s}
                    </button>
                  ))}
                </div>

                {/* Step 0: Basic Info */}
                {regStep===0&&(
                  <div>
                    <div className="form-grid" style={S.formGrid}>
                      {[["Business Name *","name","e.g. Kolkata Grand Feast"],["Owner / Manager *","ownerName","Full name"]].map(([lbl,key,ph])=>(
                        <div key={key} style={S.fieldWrap}><label style={S.fieldLabel}>{lbl}</label>
                          <input style={{...S.inp2,borderColor:regErrors[key]?"#ef4444":"var(--border-default)"}} value={regForm[key]} onChange={e=>setRegForm({...regForm,[key]:e.target.value})} placeholder={ph}/>
                          {regErrors[key]&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors[key]}</div>}
                        </div>
                      ))}
                      <div style={S.fieldWrap}><label style={S.fieldLabel}>WhatsApp Number *</label>
                        <div style={{display:"flex",border:`1px solid ${regErrors.phone?"#ef4444":"var(--border-default)"}`,borderRadius:9,overflow:"hidden"}}>
                          <div style={{padding:"11px 10px",background:"var(--bg-hover)",color:"var(--text-secondary)",fontSize:12,borderRight:"1px solid var(--border-default)",whiteSpace:"nowrap"}}>+91</div>
                          <input style={{...S.inp2,border:"none",borderRadius:0,flex:1}} type="tel" maxLength={10} value={regForm.phone} onChange={e=>setRegForm({...regForm,phone:e.target.value.replace(/\D/g,"")})} placeholder="10-digit WhatsApp number"/>
                        </div>
                        {regErrors.phone&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors.phone}</div>}
                        <div style={{fontSize:11,color:"var(--text-muted)",marginTop:3}}>📲 Hidden from customers. Quote requests via WhatsApp.</div>
                      </div>
                      <div style={S.fieldWrap}><label style={S.fieldLabel}>Email *</label>
                        <input style={{...S.inp2,borderColor:regErrors.email?"#ef4444":"var(--border-default)"}} type="email" value={regForm.email} onChange={e=>setRegForm({...regForm,email:e.target.value})} placeholder="business@email.com"/>
                        {regErrors.email&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors.email}</div>}
                      </div>
                      <div style={{...S.fieldWrap,gridColumn:"1 / -1"}}><label style={S.fieldLabel}>Full Address *</label>
                        <input style={{...S.inp2,borderColor:regErrors.address?"#ef4444":"var(--border-default)"}} value={regForm.address} onChange={e=>setRegForm({...regForm,address:e.target.value})} placeholder="Plot/Flat No., Block/Area, Street"/>
                        {regErrors.address&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors.address}</div>}
                      </div>
                      <div style={S.fieldWrap}><label style={S.fieldLabel}>Pincode *</label>
                        <input style={{...S.inp2,borderColor:regErrors.pincode?"#ef4444":"var(--border-default)"}} maxLength={6} value={regForm.pincode} onChange={e=>setRegForm({...regForm,pincode:e.target.value.replace(/\D/g,"")})} placeholder="e.g. 700156"/>
                        {regErrors.pincode&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors.pincode}</div>}
                        <div style={{fontSize:10,color:"var(--text-muted)",marginTop:2}}>700156, 700157, 700135, 700161, 700136, 700059, 700091, 700105, 700107, 700160</div>
                      </div>
                    </div>
                    <div style={{marginTop:16}}>
                      <label style={S.fieldLabel}>FSSAI License No. <span style={{color:"#c0392b"}}>*</span> <span style={{color:"#7B634E",fontWeight:400,fontSize:11}}>(mandatory · type "Applied" if pending)</span></label>
                      <input style={{...S.inp2,...(regErrors.fssaiLicense?{borderColor:"#c0392b"}:{})}} value={regForm.fssaiLicense} onChange={e=>setRegForm({...regForm,fssaiLicense:e.target.value})} placeholder='14-digit FSSAI number, or type "Applied"'/>
                      {regErrors.fssaiLicense&&<div style={{color:"#c0392b",fontSize:12,marginTop:4}}>⚠️ {regErrors.fssaiLicense}</div>}
                    </div>
                    <div style={{display:"flex",gap:12,marginTop:12}}>
                      <div style={{flex:1}}><label style={S.fieldLabel}>Years in Business</label>
                        <select value={regForm.yearsInBusiness} onChange={e=>setRegForm({...regForm,yearsInBusiness:e.target.value})} style={{...S.inp2,width:"100%"}}>
                          <option value="">Select</option>{["<1 year","1–3 years","3–5 years","5–10 years","10+ years"].map(y=><option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div style={{flex:1}}><label style={S.fieldLabel}>Team Size</label>
                        <select value={regForm.teamSize} onChange={e=>setRegForm({...regForm,teamSize:e.target.value})} style={{...S.inp2,width:"100%"}}>
                          <option value="">Select</option>{["1–5","5–10","10–20","20–50","50+"].map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{marginTop:16}}>
                      <label style={S.fieldLabel}>Business Description (used for AI matching)</label>
                      <textarea value={regForm.description} onChange={e=>setRegForm({...regForm,description:e.target.value})} placeholder="Describe your catering business, specialties, USP, notable clients..." style={{...S.inp2,minHeight:80,resize:"vertical",width:"100%"}}/>
                    </div>
                  </div>
                )}

                {/* Step 1: Services */}
                {regStep===1&&(
                  <div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Event Types *</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                        {EVENT_TYPES.map(et=><button key={et.id} onClick={()=>setRegForm(f=>({...f,specialty:f.specialty.includes(et.id)?f.specialty.filter(s=>s!==et.id):[...f.specialty,et.id]}))} style={{padding:"8px 16px",borderRadius:10,border:`2px solid ${regForm.specialty.includes(et.id)?"#c0392b":"var(--border-default)"}`,background:regForm.specialty.includes(et.id)?"var(--bg-accent-light)":"var(--bg-card)",color:regForm.specialty.includes(et.id)?"var(--text-accent)":"var(--text-secondary)",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><span>{et.icon}</span>{et.label}</button>)}
                      </div>
                      {regErrors.specialty&&<div style={{fontSize:11,color:"#ef4444",marginTop:4}}>{regErrors.specialty}</div>}
                    </div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Cuisine Specialties *</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                        {ALL_CUISINES.map(c=><button key={c} onClick={()=>setRegForm(f=>({...f,cuisineSpecialties:f.cuisineSpecialties.includes(c)?f.cuisineSpecialties.filter(s=>s!==c):[...f.cuisineSpecialties,c]}))} style={{padding:"6px 14px",borderRadius:10,border:`1.5px solid ${regForm.cuisineSpecialties.includes(c)?"#c0392b":"var(--border-default)"}`,background:regForm.cuisineSpecialties.includes(c)?"var(--bg-accent-light)":"var(--bg-card)",color:regForm.cuisineSpecialties.includes(c)?"var(--text-accent)":"var(--text-secondary)",fontSize:12,cursor:"pointer"}}>{c}</button>)}
                      </div>
                      {regErrors.cuisineSpecialties&&<div style={{fontSize:11,color:"#ef4444",marginTop:4}}>{regErrors.cuisineSpecialties}</div>}
                    </div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Service Types *</label>
                      <div style={{display:"flex",gap:8,marginTop:6}}>
                        {Object.values(SVC).map(svc=><button key={svc.id} onClick={()=>setRegForm(f=>({...f,serviceTypes:f.serviceTypes.includes(svc.id)?f.serviceTypes.filter(s=>s!==svc.id):[...f.serviceTypes,svc.id]}))} style={{flex:1,padding:"14px",borderRadius:12,border:`2px solid ${regForm.serviceTypes.includes(svc.id)?svc.color:"var(--border-default)"}`,background:regForm.serviceTypes.includes(svc.id)?svc.grad:"var(--bg-card)",cursor:"pointer",textAlign:"center"}}><div style={{fontSize:22}}>{svc.icon}</div><div style={{fontSize:12,fontWeight:700,color:svc.color,marginTop:4}}>{svc.label}</div></button>)}
                      </div>
                      {regErrors.serviceTypes&&<div style={{fontSize:11,color:"#ef4444",marginTop:4}}>{regErrors.serviceTypes}</div>}
                    </div>
                    <div>
                      <label style={S.fieldLabel}>Delivery Coverage (Pincodes)</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                        {Object.entries(PINCODE_COORDS).map(([pin,data])=><button key={pin} onClick={()=>setRegForm(f=>({...f,deliveryPincodes:f.deliveryPincodes.includes(pin)?f.deliveryPincodes.filter(p=>p!==pin):[...f.deliveryPincodes,pin]}))} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${regForm.deliveryPincodes.includes(pin)?"#c0392b":"var(--border-default)"}`,background:regForm.deliveryPincodes.includes(pin)?"var(--bg-accent-light)":"var(--bg-card)",color:regForm.deliveryPincodes.includes(pin)?"var(--text-accent)":"var(--text-secondary)",fontSize:11,cursor:"pointer"}}>{pin} · {data.area}</button>)}
                      </div>
                      <div style={{fontSize:11,color:"var(--text-muted)",marginTop:4}}>Leave empty = serves all areas</div>
                    </div>
                  </div>
                )}

                {/* Step 2: Capacity & Pricing */}
                {regStep===2&&(
                  <div>
                    <div style={{display:"flex",gap:12,marginBottom:16}}>
                      <div style={{flex:1}}>
                        <label style={S.fieldLabel}>Minimum Guests</label>
                        <input type="number" style={S.inp2} value={regForm.minGuests} onChange={e=>setRegForm({...regForm,minGuests:parseInt(e.target.value)||1})} min={1}/>
                      </div>
                      <div style={{flex:1}}>
                        <label style={S.fieldLabel}>Maximum Guests</label>
                        <input type="number" style={S.inp2} value={regForm.maxGuests} onChange={e=>setRegForm({...regForm,maxGuests:parseInt(e.target.value)||500})} min={10}/>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:12,marginBottom:16}}>
                      <div style={{flex:1}}>
                        <label style={S.fieldLabel}>Price per Plate — MIN (₹)</label>
                        <input type="number" style={S.inp2} value={regForm.pricePerPlateMin} onChange={e=>setRegForm({...regForm,pricePerPlateMin:parseInt(e.target.value)||100})} min={50}/>
                      </div>
                      <div style={{flex:1}}>
                        <label style={S.fieldLabel}>Price per Plate — MAX (₹)</label>
                        <input type="number" style={S.inp2} value={regForm.pricePerPlateMax} onChange={e=>setRegForm({...regForm,pricePerPlateMax:parseInt(e.target.value)||2000})} min={100}/>
                      </div>
                    </div>
                    {regErrors.pricing&&<div style={{fontSize:11,color:"#ef4444",marginBottom:8}}>{regErrors.pricing}</div>}
                    <div style={{display:"flex",gap:12,marginBottom:16}}>
                      <div style={{flex:1}}>
                        <label style={S.fieldLabel}>Preparation Time</label>
                        <select value={regForm.turnaround} onChange={e=>setRegForm({...regForm,turnaround:e.target.value})} style={{...S.inp2,width:"100%"}}>
                          {["1–2 hrs","2–3 hrs","3–4 hrs","4–6 hrs","Same day","Next day"].map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={{flex:1}}>
                        <label style={S.fieldLabel}>Price Tier</label>
                        <select value={regForm.priceRange} onChange={e=>setRegForm({...regForm,priceRange:e.target.value})} style={{...S.inp2,width:"100%"}}>
                          {["₹ (Budget)","₹₹ (Moderate)","₹₹₹ (Premium)","₹₹₹₹ (Luxury)"].map(p=><option key={p} value={p.split(" ")[0]}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Available Days</label>
                      <div style={{display:"flex",gap:6,marginTop:6}}>
                        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><button key={d} onClick={()=>setRegForm(f=>({...f,availableDays:f.availableDays.includes(d)?f.availableDays.filter(x=>x!==d):[...f.availableDays,d]}))} style={{flex:1,padding:"8px 4px",borderRadius:8,border:`1.5px solid ${regForm.availableDays.includes(d)?"#c0392b":"var(--border-default)"}`,background:regForm.availableDays.includes(d)?"var(--bg-accent-light)":"var(--bg-card)",color:regForm.availableDays.includes(d)?"var(--text-accent)":"var(--text-muted)",fontSize:11,fontWeight:600,cursor:"pointer"}}>{d}</button>)}
                      </div>
                    </div>
                    <div>
                      <label style={S.fieldLabel}>Cancellation Policy</label>
                      <select value={regForm.cancellationPolicy} onChange={e=>setRegForm({...regForm,cancellationPolicy:e.target.value})} style={{...S.inp2,width:"100%"}}>
                        {["24hrs","48hrs","72hrs","No refund","Flexible"].map(c=><option key={c} value={c}>{c} notice required</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Step 3: Menu & Extras */}
                {regStep===3&&(
                  <div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Signature Dishes (top 5–10, comma separated)</label>
                      <textarea value={regForm.signatureDishes} onChange={e=>setRegForm({...regForm,signatureDishes:e.target.value})} placeholder="Kosha Mangsho, Chingri Malai Curry, Luchi-Alur Dom, Biryani, Mishti Doi..." style={{...S.inp2,minHeight:60,resize:"vertical",width:"100%"}}/>
                      <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>These are used for AI search & menu matching</div>
                    </div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Menu Categories Offered</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                        {Object.keys(MENU_ITEMS).map(cat=><button key={cat} onClick={()=>setRegForm(f=>({...f,menuHighlights:f.menuHighlights.includes(cat)?f.menuHighlights.filter(c=>c!==cat):[...f.menuHighlights,cat]}))} style={{padding:"6px 14px",borderRadius:10,border:`1.5px solid ${regForm.menuHighlights.includes(cat)?"#c0392b":"var(--border-default)"}`,background:regForm.menuHighlights.includes(cat)?"var(--bg-accent-light)":"var(--bg-card)",color:regForm.menuHighlights.includes(cat)?"var(--text-accent)":"var(--text-secondary)",fontSize:12,cursor:"pointer"}}>{cat}</button>)}
                      </div>
                    </div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Service Features</label>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:6}}>
                        {[{key:"vegOnly",label:"🥬 Vegetarian Only",desc:"Only serves veg food"},{key:"hasLiveCounter",label:"🔥 Live Counters",desc:"Provides live cooking stations"},{key:"providesDecor",label:"🎊 Decoration",desc:"Provides event decoration"},{key:"providesStaff",label:"👨‍🍳 Staff Included",desc:"Serving staff provided"}].map(f=>(
                          <button key={f.key} onClick={()=>setRegForm(r=>({...r,[f.key]:!r[f.key]}))} style={{padding:"12px",borderRadius:10,border:`2px solid ${regForm[f.key]?"#c0392b":"var(--border-default)"}`,background:regForm[f.key]?"var(--bg-accent-light)":"var(--bg-card)",cursor:"pointer",textAlign:"left"}}>
                            <div style={{fontSize:13,fontWeight:regForm[f.key]?700:500,color:regForm[f.key]?"var(--text-accent)":"var(--text-primary)"}}>{f.label}</div>
                            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{f.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={S.fieldLabel}>Payment Modes Accepted</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                        {["Cash","UPI","Card","Bank Transfer","Cheque"].map(m=><button key={m} onClick={()=>setRegForm(f=>({...f,paymentModes:f.paymentModes.includes(m)?f.paymentModes.filter(x=>x!==m):[...f.paymentModes,m]}))} style={{padding:"6px 14px",borderRadius:10,border:`1.5px solid ${regForm.paymentModes.includes(m)?"#c0392b":"var(--border-default)"}`,background:regForm.paymentModes.includes(m)?"var(--bg-accent-light)":"var(--bg-card)",color:regForm.paymentModes.includes(m)?"var(--text-accent)":"var(--text-secondary)",fontSize:12,cursor:"pointer"}}>{m}</button>)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div style={{background:"var(--bg-accent-light)",border:"1px solid var(--border-accent)",borderRadius:10,padding:"12px 16px",fontSize:12,color:"var(--text-secondary)",lineHeight:1.6,marginTop:20}}>🔒 Your phone number is never shown to customers. Aayojan acts as the secure intermediary.</div>
                <div style={{display:"flex",gap:10,marginTop:18}}>
                  {regStep===0?<button onClick={()=>navigate("landing")} style={S.secondaryBtn}>← Home</button>:<button onClick={()=>setRegStep(s=>s-1)} style={{...S.secondaryBtn,flex:1}}>← Back</button>}
                  {regStep<3?(
                    <button onClick={()=>setRegStep(s=>s+1)} style={{...S.primaryBtn,flex:1,marginTop:0}}>Next →</button>
                  ):(
                    <button onClick={submitReg} style={{...S.primaryBtn,flex:1,marginTop:0}}>Register Business 🚀</button>
                  )}
                </div>
              </div>
            </>:(
              <div style={{...S.card,textAlign:"center",padding:"32px"}}>
                <div style={{fontSize:56}}>🎉</div>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"var(--text-primary)",margin:"10px 0 6px"}}>You're Registered!</h2>
                <p style={{color:"var(--text-secondary)",marginBottom:20}}>Welcome to Aayojan, <strong style={{color:"#c0392b"}}>{regForm.name}</strong></p>
                <div style={{background:"var(--bg-accent-light)",border:"1px solid var(--border-light)",borderRadius:12,padding:"16px",textAlign:"left",marginBottom:20}}>
                  {[["📍 Area",PINCODE_COORDS[regForm.pincode]?.area||regForm.pincode],["🛎️ Services",regForm.serviceTypes.map(t=>SVC[t].label).join(", ")],["🍽️ Cuisines",regForm.cuisineSpecialties.join(", ")],["📲 WhatsApp",`+91 ${String(regForm.phone).slice(0,5)}••••• (hidden)`],["📊 Capacity",`${regForm.minGuests}–${regForm.maxGuests} guests`],["💰 Price Range",`₹${regForm.pricePerPlateMin}–₹${regForm.pricePerPlateMax}/plate`],["🔖 FSSAI",regForm.fssaiLicense||"Not provided"]].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:8,color:"var(--text-secondary)"}}><span>{l}</span><span style={{textAlign:"right",maxWidth:"60%",color:"var(--text-primary)"}}>{v}</span></div>
                  ))}
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>{setRegSuccess(false);setRegStep(0);setRegForm({name:"",ownerName:"",phone:"",email:"",address:"",pincode:"",specialty:[],cuisineSpecialties:[],serviceTypes:[],priceRange:"₹₹",turnaround:"2–3 hrs",minGuests:10,maxGuests:500,pricePerPlateMin:150,pricePerPlateMax:800,fssaiLicense:"",yearsInBusiness:"",teamSize:"",signatureDishes:"",description:"",deliveryPincodes:[],menuHighlights:[],vegOnly:false,hasLiveCounter:false,providesDecor:false,providesStaff:true,paymentModes:["Cash","UPI"],cancellationPolicy:"48hrs",availableDays:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]});}} style={S.secondaryBtn}>Register Another</button>
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
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"12px 8px 4px",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              {STEPS.map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",flexShrink:0}}>
                  <div style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",transition:"all 0.3s",zIndex:1,background:i<=step?accent:"#d1d5db",boxShadow:i===step?`0 0 0 3px ${accent}33`:"none",transform:i===step?"scale(1.15)":"scale(1)"}}>{i<step?"✓":i+1}</div>
                  {i<STEPS.length-1&&<div style={{width:20,height:2,background:i<step?accent:"#e5e7eb",transition:"background 0.3s"}}/>}
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"center",padding:"3px 4px 14px",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              {STEPS.map((s,i)=><span key={i} style={{minWidth:44,maxWidth:56,flex:"1 1 auto",textAlign:"center",fontSize:8,fontWeight:600,letterSpacing:"0.03em",textTransform:"uppercase",color:i===step?accent:"#9ca3af"}}>{s}</span>)}
            </div>
          </>}

          <div style={S.card}>
            {/* Step 0: Service */}
            {step===0&&<div>
              <h2 style={S.cardTitle}>Choose Your Service</h2>
              <p style={{fontSize:14,color:"#6b7280",marginBottom:20}}>How would you like your catering?</p>
              <div className="service-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {Object.values(SVC).map(svc=>(
                  <button key={svc.id} onClick={()=>{setServiceType(svc.id);setStep(1);track('service_selected',{service_type:svc.id});}} style={{border:`2px solid ${svc.border}`,borderRadius:16,padding:"22px 18px",cursor:"pointer",background:svc.grad,textAlign:"left",display:"flex",flexDirection:"column",gap:8}}>
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
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setStep(0)} style={S.secondaryBtn}>← Back</button>
                <button onClick={handlePincodeNext} disabled={customerPincode.length!==6} style={{...S.primaryBtn,marginTop:0,flex:1,background:accentGrad,opacity:customerPincode.length===6?1:0.4}}>Find Caterers Near Me →</button>
              </div>
            </div>}

            {/* Step 2: Event + Dietary */}
            {step===2&&<div>
              <h2 style={S.cardTitle}>What's the occasion?</h2>
              <p style={{fontSize:14,color:"#6b7280",marginBottom:18}}>Near {customerCoords?.area} · {stCfg?.label}</p>
              <div className="event-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
                {EVENT_TYPES.map(e=><button key={e.id} onClick={()=>{setEventType(e.id);if(e.id==="religious")setDietaryPref("satvik");else if(dietaryPref==="satvik"&&e.id!=="religious")setDietaryPref("any");}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"14px 10px",border:`2px solid ${eventType===e.id?accent:"var(--border-color, #e5e7eb)"}`,borderRadius:12,cursor:"pointer",background:eventType===e.id?"#fff5f5":"var(--bg-card, #fff)",transform:eventType===e.id?"translateY(-2px)":"none",transition:"all 0.2s"}}>
                  <span style={{fontSize:28}}>{e.icon}</span><span style={{fontSize:13,fontWeight:700,color:"var(--text-primary, #1f2937)"}}>{e.label}</span><span style={{fontSize:10,color:"#9ca3af",textAlign:"center"}}>{e.desc}</span>
                </button>)}
              </div>

              {/* Dietary Preference */}
              {eventType&&<div style={{borderTop:"1px solid var(--border-color, #fde8d8)",paddingTop:18,marginBottom:18}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--text-primary, #374151)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>🥗 Dietary Preference</div>
                <p style={{fontSize:12,color:"#9ca3af",marginBottom:12}}>Only caterers matching your dietary needs will be shown</p>
                {eventType==="religious"&&dietaryPref!=="veg"&&dietaryPref!=="jain"&&dietaryPref!=="satvik"&&dietaryPref!=="vegan"&&(
                  <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#92400e",marginBottom:10}}>⚠️ Religious ceremonies typically require vegetarian/satvik food. We've set Satvik as default — you can change if needed.</div>
                )}
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {DIETARY_TYPES.map(d=>{
                    const selected=dietaryPref===d.id;
                    const isVegType=["veg","jain","satvik","vegan"].includes(d.id);
                    return <button key={d.id} onClick={()=>setDietaryPref(d.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",border:`2px solid ${selected?d.color:"var(--border-color, #e5e7eb)"}`,borderRadius:20,cursor:"pointer",background:selected?`${d.color}15`:"var(--bg-card, #fff)",transition:"all 0.2s",fontSize:13,fontWeight:selected?700:500,color:selected?d.color:"var(--text-primary, #6b7280)"}}>
                      <span style={{fontSize:16}}>{d.icon}</span>
                      {d.label}
                      {isVegType&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0",fontWeight:700}}>VEG</span>}
                    </button>;
                  })}
                </div>
              </div>}

              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setStep(1)} style={S.secondaryBtn}>← Back</button>
                <button onClick={()=>setStep(3)} disabled={!eventType} style={{...S.primaryBtn,marginTop:0,flex:1,background:accentGrad,opacity:eventType?1:0.4}}>Continue →</button>
              </div>
            </div>}

            {/* Step 3: Guests + Budget */}
            {step===3&&<div>
              <h2 style={S.cardTitle}>Guests & Budget</h2>
              <p style={{fontSize:14,color:"#6b7280",marginBottom:18}}>Set headcount and per-{serviceType==="full"?"plate":"portion"} budget</p>

              {/* Event Date */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--text-primary, #374151)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>📅 Event Date</div>
                <input type="date" value={eventDate} min={new Date(Date.now()+86400000).toISOString().split("T")[0]} onChange={e=>setEventDate(e.target.value)} style={{width:"100%",padding:"12px 16px",border:`2px solid ${eventDate?"var(--text-accent, #c0392b)":"var(--border-default, #e5e7eb)"}`,borderRadius:10,fontSize:15,fontWeight:600,color:"var(--text-primary, #1f2937)",background:"var(--bg-input, #fff)",outline:"none"}}/>
                {eventDate&&(()=>{const d=new Date(eventDate);const days=Math.ceil((d-new Date())/(86400000));return <div style={{marginTop:6,fontSize:12,color:days<3?"#ef4444":days<7?"#f59e0b":"#16a34a",fontWeight:600}}>{days<3?"⚡ Express order — less than 3 days!":days<7?`⏰ ${days} days away — Standard timeline`:`✅ ${days} days away — plenty of time for best quotes`}</div>;})()}
              </div>

              {/* Meal Time */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--text-primary, #374151)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>🕐 Meal Time</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {[{id:"breakfast",label:"Breakfast",icon:"🌅",time:"8-11 AM"},{id:"lunch",label:"Lunch",icon:"☀️",time:"12-3 PM"},{id:"snacks",label:"Evening Snacks",icon:"🌇",time:"4-6 PM"},{id:"dinner",label:"Dinner",icon:"🌙",time:"7-11 PM"}].map(t=>(
                    <button key={t.id} onClick={()=>setMealTime(t.id)} style={{flex:"1 1 calc(50% - 4px)",padding:"10px 8px",borderRadius:10,border:`2px solid ${mealTime===t.id?"var(--text-accent, #c0392b)":"var(--border-default, #e5e7eb)"}`,background:mealTime===t.id?"#fff5f5":"var(--bg-input, #fff)",cursor:"pointer",textAlign:"center",transition:"all 0.2s"}}>
                      <div style={{fontSize:20}}>{t.icon}</div>
                      <div style={{fontSize:12,fontWeight:700,color:mealTime===t.id?"#c0392b":"var(--text-primary, #374151)",marginTop:2}}>{t.label}</div>
                      <div style={{fontSize:10,color:"var(--text-secondary, #6b7280)"}}>{t.time}</div>
                    </button>
                  ))}
                </div>
              </div>

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
                <button onClick={()=>{
                  // Clear any selected items that don't match current dietary filter
                  if(dietaryPref!=="any"){
                    setSelectedItems(prev=>prev.filter(item=>{
                      const allItems=Object.values(MENU_ITEMS).flat();
                      if(!allItems.includes(item)) return true; // keep custom items
                      return filterMenuByDiet([item],dietaryPref).length>0;
                    }));
                  }
                  setStep(4);
                }} disabled={(serviceType==="full"&&guestCount<30)||!eventDate||!mealTime} style={{...S.primaryBtn,marginTop:0,flex:1,background:accentGrad,opacity:((serviceType==="full"&&guestCount<30)||!eventDate||!mealTime)?0.4:1}}>Continue to Menu →</button>
              </div>
            </div>}

            {/* Step 4: Menu */}
            {step===4&&<div>
              <h2 style={S.cardTitle}>Build Your Menu</h2>
              <p style={{fontSize:14,color:"#6b7280",marginBottom:12}}>{selectedItems.length} selected · Budget: <span style={{color:accent,fontWeight:700}}>₹{perPlateBudget}/{serviceType==="full"?"plate":"portion"}</span></p>

              {/* Dietary badge + change option */}
              {(()=>{const dt=DIETARY_TYPES.find(d=>d.id===dietaryPref);return dt?(
                <div style={{display:"flex",alignItems:"center",gap:10,background:dietaryPref==="any"?"var(--bg-secondary, #f9fafb)":`${dt.color}10`,border:`1.5px solid ${dt.color}40`,borderRadius:10,padding:"10px 14px",marginBottom:16}}>
                  <span style={{fontSize:22}}>{dt.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:dt.color}}>{dt.label}</div>
                    <div style={{fontSize:11,color:"var(--text-secondary, #6b7280)"}}>{dt.desc}</div>
                  </div>
                  <button onClick={()=>setStep(2)} style={{fontSize:11,padding:"5px 12px",borderRadius:8,background:"var(--bg-card, #fff)",border:"1px solid var(--border-color, #e5e7eb)",color:"var(--text-secondary, #6b7280)",cursor:"pointer",fontWeight:600}}>Change ✏️</button>
                </div>
              ):null;})()}

              {Object.entries(MENU_ITEMS).map(([cat,items])=>{
                const filtered=filterMenuByDiet(items,dietaryPref);
                if(filtered.length===0) return null;
                return(
                <div key={cat} style={{marginBottom:18}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:accent,marginBottom:8,paddingBottom:5,borderBottom:`1px solid #fde8d8`}}>{cat}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {filtered.map(item=><button key={item} onClick={()=>toggleItem(item)} style={{padding:"5px 12px",borderRadius:16,fontSize:12,fontWeight:500,cursor:"pointer",border:"1px solid",transition:"all 0.15s",background:selectedItems.includes(item)?accent:"var(--bg-card, #fff)",color:selectedItems.includes(item)?"#fff":"var(--text-primary, #374151)",borderColor:selectedItems.includes(item)?accent:"var(--border-color, #e5e7eb)"}}>{selectedItems.includes(item)&&"✓ "}{item}</button>)}
                  </div>
                </div>
              );})}
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
                <div><div style={{fontWeight:700,color:"#1f2937",marginBottom:2}}>Quotation in 48 Hours</div><div style={{fontSize:12,color:"#6b7280",lineHeight:1.5}}>WhatsApp sent to <strong style={{color:accent}}>matched verified caterers</strong> near you with budget <strong style={{color:accent}}>₹{perPlateBudget}/{serviceType==="full"?"plate":"portion"}</strong>.</div></div>
              </div>
              {!user&&selectedItems.length>0&&<div style={{background:"#fff7ed",border:"1px solid #fdba74",borderRadius:8,padding:"10px 14px",fontSize:12,color:"var(--text-secondary)",marginTop:10}}>🔒 Login required to send quote requests.</div>}
              <div style={{display:"flex",gap:10,marginTop:18}}>
                <button onClick={()=>setStep(3)} style={S.secondaryBtn}>← Back</button>
                <button onClick={generateQuotes} disabled={selectedItems.length===0} style={{...S.primaryBtn,marginTop:0,flex:1,background:accentGrad,opacity:selectedItems.length>0?1:0.4}}>
                  {loading?"Sending...":user?"Send Quotation Request 📲":"Login & Send Request 🔒"}
                </button>
              </div>
              {loading&&<div style={{marginTop:14,height:3,background:"#fde8d8",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",background:accentGrad,animation:"loadSlide 1.6s ease forwards"}}/></div>}
            </div>}

            {/* Step 5: Quotes */}
            {step===5&&<div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div><h2 style={S.cardTitle}>Quotation Sent! ✅</h2><p style={{fontSize:13,color:"#6b7280",marginBottom:18}}>{quotes.length} caterers matched · {stCfg?.label}</p></div>
                {user&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"5px 10px",fontSize:11,color:"#16a34a"}}>✅ {user.phone}</div>}
              </div>

              {/* Pipeline stats */}
              {quotationRequest?.pipeline&&<div className="pipeline-stats" style={{display:"flex",gap:6,alignItems:"center",background:"var(--bg-secondary, #f9fafb)",border:"1px solid var(--border-color, #e5e7eb)",borderRadius:10,padding:"10px 14px",marginBottom:14,flexWrap:"wrap"}}>
                <span style={{fontSize:11,fontWeight:700,color:"var(--text-secondary, #6b7280)"}}>🔍 Pipeline:</span>
                {[["🗂️",quotationRequest.pipeline.totalCaterers,"Total"],["✅",quotationRequest.pipeline.afterRetrieval,"Eligible"],["📊",quotationRequest.pipeline.afterRanking,"Ranked"],["🏆",quotationRequest.pipeline.finalCount,"Selected"]].map(([icon,val,lbl])=>(
                  <span key={lbl} style={{fontSize:11,padding:"2px 8px",borderRadius:8,background:"#fff5f5",color:accent,border:"1px solid #fca5a5",fontWeight:600}}>{icon} {val} {lbl}</span>
                ))}
              </div>}

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
              <div className="summary-bar" style={{display:"flex",justifyContent:"space-around",background:"#fff5f5",border:"1px solid #fde8d8",borderRadius:10,padding:"10px",marginBottom:12}}>
                {[["📅",eventDate?new Date(eventDate).toLocaleDateString("en-IN",{day:"numeric",month:"short"}):"—","Date"],["🕐",{breakfast:"Morning",lunch:"Afternoon",snacks:"Evening",dinner:"Night"}[mealTime]||"—","Time"],["📍",customerPincode,"Pincode"],["👥",guestCount,"Guests"],[`💰`,`₹${perPlateBudget}`,serviceType==="full"?"Per Plate":"Per Portion"],["🍽️",selectedItems.length,"Dishes"],[DIETARY_TYPES.find(d=>d.id===dietaryPref)?.icon||"🍽️",DIETARY_TYPES.find(d=>d.id===dietaryPref)?.label||"Any","Diet"]].map(([icon,val,lbl])=>(
                  <div key={lbl} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:0}}>
                    <span style={{fontSize:12}}>{icon}</span><span style={{fontSize:12,fontWeight:800,color:accent}}>{val}</span><span style={{fontSize:8,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.04em"}}>{lbl}</span>
                  </div>
                ))}
              </div>

              <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"9px 12px",fontSize:12,color:"#6b7280",marginBottom:14}}>
                Sorted by per-plate price. <span style={{color:"#16a34a"}}>🟢 Within budget</span> · <span style={{color:"#ef4444"}}>🔴 Over budget</span> · Beyond 5 km: <strong style={{color:accent}}>+₹{KM_RATE}/km</strong>
              </div>

              {quotes.map((q,qi)=>(
                <div key={q.id} style={{background:"var(--bg-card, #fff)",border:`1.5px solid ${selectedQuote?.id===q.id?"#16a34a":expandedCaterer===q.id?accent:"var(--border-color, #fde8d8)"}`,borderRadius:14,padding:"16px 18px",marginBottom:12,boxShadow:"0 2px 8px rgba(192,57,43,0.06)"}}>
                  {/* Match score + Budget & distance badges */}
                  <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,padding:"3px 10px",borderRadius:14,fontWeight:800,background:"linear-gradient(135deg,#fff5f5,#ffe4e6)",color:accent,border:`1px solid ${accent}`}}>
                      {q._matchPercent||0}% Match
                    </span>
                    <span style={{fontSize:11,padding:"3px 10px",borderRadius:14,fontWeight:700,background:q.withinBudget?"#f0fdf4":"#fef2f2",color:q.withinBudget?"#16a34a":"#ef4444",border:`1px solid ${q.withinBudget?"#bbf7d0":"#fecaca"}`}}>
                      {q.withinBudget?`✓ Within budget · ₹${q.perPlateActual}/plate`:`⚠ Over budget · ₹${q.perPlateActual}/plate`}
                    </span>
                    <span style={{fontSize:11,padding:"3px 10px",borderRadius:14,fontWeight:600,background:q.distanceKm<=5?"#f0fdf4":"#fff7ed",color:q.distanceKm<=5?"#16a34a":"#ea580c",border:`1px solid ${q.distanceKm<=5?"#bbf7d0":"#fdba74"}`}}>
                      📍 {q.distanceKm} km {q.distanceKm<=5?"✓ Free zone":`+₹${q.travelSurcharge}`}
                    </span>
                    {q._boostReasons?.map(r=><span key={r} style={{fontSize:11,padding:"3px 10px",borderRadius:14,fontWeight:600,background:"#fffbeb",color:"#92400e",border:"1px solid #fde68a"}}>{r}</span>)}
                  </div>

                  <div style={{display:"flex",gap:12,marginBottom:10}}>
                    <div style={{width:46,height:46,fontSize:22,background:"#fff5f5",borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{q._anonIcon||q.logo}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,fontWeight:700,color:"var(--text-primary, #1f2937)",marginBottom:2}}>{q._anonLabel||q.name}</div>
                      <div style={{fontSize:11,color:"#9ca3af",marginBottom:3}}>⭐{q.rating} · 📍{PINCODE_COORDS[q.pincode]?.area} · ⏱{q.turnaround}{q.yearsInBusiness?` · ${q.yearsInBusiness}yr exp`:""}</div>

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
                <div style={{fontSize:11,color:"#16a34a",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Selected Caterer — Identity Revealed ✅</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"#1f2937"}}>{selectedQuote.logo} {selectedQuote._realName||selectedQuote.name}</div>
                    {selectedQuote._anonLabel&&<div style={{fontSize:11,color:"#9ca3af",marginBottom:2}}>Previously shown as: {selectedQuote._anonLabel}</div>}
                    <div style={{fontSize:12,color:"#9ca3af"}}>
                      {unlockedPhones[selectedQuote.id]?<span style={{color:"#16a34a",fontWeight:700}}>📞 +91 {unlockedPhones[selectedQuote.id]}</span>:<span>📞 ••••••••••</span>}
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
                {[["Service",stCfg?.label],["Event",eventType],["Date",eventDate?new Date(eventDate).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"—"],["Meal Time",{breakfast:"Breakfast (8-11 AM)",lunch:"Lunch (12-3 PM)",snacks:"Evening Snacks (4-6 PM)",dinner:"Dinner (7-11 PM)"}[mealTime]||"—"],["Guests",guestCount],["Per "+(serviceType==="full"?"plate":"portion"),`₹${selectedQuote.perPlateActual} (budget ₹${perPlateBudget})`],["Food Total",`₹${selectedQuote.basePrice.toLocaleString()}`],...(selectedQuote.travelSurcharge>0?[["Travel",`+₹${selectedQuote.travelSurcharge}`]]:[])]
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
                <button onClick={()=>{navigate("landing");resetApp();}} style={{...S.primaryBtn,marginTop:0,flex:1}}>Back to Home</button>
              </div>
            </div>}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          USER PROFILE
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="profile"&&user&&(
        <div style={{...S.page,...anim}}>
          {/* Profile Header Card */}
          <div style={{...S.card,padding:"28px 32px",marginBottom:20,textAlign:"center",position:"relative",background:"linear-gradient(135deg,#fff5f5,#fef9f7)"}}>
            <div style={{width:72,height:72,borderRadius:"50%",margin:"0 auto 12px",background:"linear-gradient(135deg,#c0392b,#e74c3c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,color:"#fff",overflow:"hidden",border:"3px solid #fff",boxShadow:"0 4px 16px rgba(192,57,43,0.2)"}}>
              {user.photoURL?<img src={user.photoURL} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"👤"}
            </div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#1f2937",marginBottom:2}}>{user.displayName||"User"}</h2>
            <p style={{fontSize:13,color:"#6b7280"}}>{user.email}</p>
            {user.phone&&<p style={{fontSize:12,color:"#9ca3af",marginTop:2}}>📱 {user.phone}</p>}
            <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:16}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:"#c0392b"}}>{userOrders.length}</div>
                <div style={{fontSize:11,color:"#9ca3af"}}>Orders</div>
              </div>
              <div style={{width:1,background:"#e5e7eb"}}/>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:"#c0392b"}}>{user.preferences?.cuisines?.length||0}</div>
                <div style={{fontSize:11,color:"#9ca3af"}}>Cuisines</div>
              </div>
              <div style={{width:1,background:"#e5e7eb"}}/>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:"#c0392b"}}>{user.preferences?.dietary==="veg"?"🥬":user.preferences?.dietary==="vegan"?"🌱":"🍗"}</div>
                <div style={{fontSize:11,color:"#9ca3af"}}>{user.preferences?.dietary||"Not set"}</div>
              </div>
            </div>
          </div>

          {/* Profile Tabs */}
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {[{id:"info",label:"📋 My Info"},{id:"orders",label:"📦 Orders"},{id:"preferences",label:"🍽️ Preferences"}].map(tab=>(
              <button key={tab.id} onClick={()=>setProfileTab(tab.id)} style={{...S.ghostBtn,flex:1,textAlign:"center",background:profileTab===tab.id?"#c0392b":"transparent",color:profileTab===tab.id?"#fff":"#6b7280",borderColor:profileTab===tab.id?"#c0392b":"#e5e7eb",fontWeight:profileTab===tab.id?700:500}}>{tab.label}</button>
            ))}
          </div>

          {/* ── Tab: My Info ────────────────────────────────────────────────── */}
          {profileTab==="info"&&(
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>Personal Information</h3>
                {!profileEdit&&<button onClick={()=>setProfileEdit(true)} style={{...S.ghostBtn,fontSize:12}}>✏️ Edit</button>}
              </div>

              {profileEdit?(
                <div>
                  <div style={{marginBottom:12}}>
                    <label style={S.fieldLabel}>Full Name</label>
                    <input style={S.inp2} value={profileForm.displayName} onChange={e=>setProfileForm(f=>({...f,displayName:e.target.value}))} placeholder="Your full name"/>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={S.fieldLabel}>📱 Phone Number</label>
                    <input style={S.inp2} value={profileForm.phone} onChange={e=>setProfileForm(f=>({...f,phone:e.target.value.replace(/[^0-9+]/g,"").slice(0,13)}))} placeholder="+91 9876543210" maxLength={13}/>
                    <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Used for delivery coordination only</div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={S.fieldLabel}>📍 Default Delivery Address</label>
                    <input style={S.inp2} value={profileForm.address} onChange={e=>setProfileForm(f=>({...f,address:e.target.value}))} placeholder="Flat/House, Building, Street"/>
                  </div>
                  <div style={{display:"flex",gap:12,marginBottom:12}}>
                    <div style={{flex:1}}>
                      <label style={S.fieldLabel}>Pincode</label>
                      <input style={S.inp2} value={profileForm.pincode} onChange={e=>setProfileForm(f=>({...f,pincode:e.target.value.replace(/\D/g,"").slice(0,6)}))} placeholder="700156" maxLength={6}/>
                    </div>
                    <div style={{flex:1}}>
                      <label style={S.fieldLabel}>City</label>
                      <input style={{...S.inp2,background:"#f9fafb"}} value={profileForm.city} disabled/>
                    </div>
                  </div>

                  <div style={{display:"flex",gap:10,marginTop:16}}>
                    <button onClick={()=>setProfileEdit(false)} style={{...S.ghostBtn,flex:1,padding:"10px 0"}}>Cancel</button>
                    <button onClick={handleSaveProfile} disabled={profileSaving} style={{...S.primaryBtn,flex:1,marginTop:0,opacity:profileSaving?0.6:1}}>
                      {profileSaving?"Saving...":"Save Changes ✓"}
                    </button>
                  </div>
                </div>
              ):(
                <div>
                  {[
                    {icon:"👤",label:"Name",value:user.displayName||"—"},
                    {icon:"✉️",label:"Email",value:user.email},
                    {icon:"📱",label:"Phone",value:user.phone||"Not added yet"},
                    {icon:"📍",label:"Address",value:user.address||"Not added yet"},
                    {icon:"📮",label:"Pincode",value:user.pincode||"—"},
                    {icon:"🏙️",label:"City",value:user.city||"Kolkata"},
                    {icon:"🔐",label:"Login Method",value:user.provider==="google.com"?"Google Account":"Email & Password"},
                  ].map(row=>(
                    <div key={row.label} style={{display:"flex",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f3f4f6"}}>
                      <span style={{fontSize:16,width:28}}>{row.icon}</span>
                      <span style={{fontSize:13,color:"#6b7280",width:90}}>{row.label}</span>
                      <span style={{fontSize:14,fontWeight:500,color:row.value.includes("Not added")?"#9ca3af":"#1f2937",flex:1}}>{row.value}</span>
                    </div>
                  ))}
                  {(!user.phone||!user.address)&&(
                    <div style={{marginTop:16,padding:"12px 16px",borderRadius:10,background:"#fffbeb",border:"1px solid #fde68a",fontSize:12,color:"#92400e"}}>
                      💡 <strong>Complete your profile!</strong> Add your phone number and address for faster order placement.
                      <button onClick={()=>setProfileEdit(true)} style={{display:"block",marginTop:8,background:"none",border:"none",color:"#c0392b",cursor:"pointer",fontWeight:700,fontSize:12}}>→ Add now</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Orders ────────────────────────────────────────────────── */}
          {profileTab==="orders"&&(
            <div>
              {ordersLoading?(
                <div style={{textAlign:"center",padding:40,color:"#6b7280"}}>Loading orders...</div>
              ):userOrders.length===0?(
                <div style={{...S.card,textAlign:"center",padding:"40px 20px"}}>
                  <div style={{fontSize:48,marginBottom:12}}>📦</div>
                  <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#1f2937",marginBottom:6}}>No Orders Yet</h3>
                  <p style={{fontSize:13,color:"#9ca3af",marginBottom:16}}>Start exploring caterers and place your first order!</p>
                  <button onClick={()=>navigate("app")} style={{...S.primaryBtn,width:"auto",padding:"10px 24px",display:"inline-block"}}>Browse Caterers →</button>
                </div>
              ):(
                <div>
                  <div style={{fontSize:13,color:"#6b7280",marginBottom:12}}>{userOrders.length} order{userOrders.length>1?"s":""}</div>
                  {userOrders.map(o=>(
                    <div key={o.id} style={{...S.card,marginBottom:12,padding:"16px 20px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:"#1f2937",marginBottom:4}}>🍽️ {o.catererName||"Caterer"}</div>
                          <div style={{fontSize:12,color:"#6b7280"}}>🎊 {o.eventType} · 👥 {o.guestCount} guests</div>
                          <div style={{fontSize:12,color:"#6b7280"}}>📍 {o.deliveryAddress||"—"}</div>
                          {o.createdAt&&<div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>🕐 {o.createdAt?.toDate?.()?.toLocaleDateString("en-IN",{dateStyle:"medium"})||"—"}</div>}
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:18,fontWeight:800,color:"#16a34a"}}>₹{o.totalPrice?.toLocaleString()||"—"}</div>
                          <span style={{fontSize:11,padding:"3px 8px",borderRadius:8,marginTop:4,display:"inline-block",background:o.status==="Confirmed"?"#f0fdf4":o.status==="Delivered"?"#eff6ff":"#fef9c3",color:o.status==="Confirmed"?"#16a34a":o.status==="Delivered"?"#2563eb":"#ca8a04",border:`1px solid ${o.status==="Confirmed"?"#bbf7d0":o.status==="Delivered"?"#bfdbfe":"#fde68a"}`}}>{o.status||"Pending"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Preferences ───────────────────────────────────────────── */}
          {profileTab==="preferences"&&(
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>Food Preferences</h3>
                <button onClick={()=>{setShowPreferences(true);setPrefStep(0);if(user.preferences)setPrefData(user.preferences);}} style={{...S.ghostBtn,fontSize:12}}>✏️ Edit</button>
              </div>

              {user.preferences?(
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                    <div style={{padding:"14px 16px",borderRadius:12,background:"#fff5f5",border:"1px solid #fca5a5"}}>
                      <div style={{fontSize:11,color:"#9ca3af",marginBottom:4}}>DIETARY</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#c0392b",textTransform:"capitalize"}}>{user.preferences.dietary==="non-veg"?"🍗 Non-Veg":user.preferences.dietary==="veg"?"🥬 Vegetarian":user.preferences.dietary==="vegan"?"🌱 Vegan":"🥚 Eggetarian"}</div>
                    </div>
                    <div style={{padding:"14px 16px",borderRadius:12,background:"#fff5f5",border:"1px solid #fca5a5"}}>
                      <div style={{fontSize:11,color:"#9ca3af",marginBottom:4}}>SPICE LEVEL</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#c0392b",textTransform:"capitalize"}}>{{"mild":"😊 Mild","medium":"😋 Medium","spicy":"🥵 Spicy","extra-spicy":"🔥 Extra Spicy"}[user.preferences.spiceLevel]||"—"}</div>
                    </div>
                    <div style={{padding:"14px 16px",borderRadius:12,background:"#fff5f5",border:"1px solid #fca5a5"}}>
                      <div style={{fontSize:11,color:"#9ca3af",marginBottom:4}}>BUDGET</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#c0392b",textTransform:"capitalize"}}>{{"budget":"💵 Budget","moderate":"💰 Moderate","premium":"💎 Premium","luxury":"👑 Luxury"}[user.preferences.budgetRange]||"—"}</div>
                    </div>
                    <div style={{padding:"14px 16px",borderRadius:12,background:"#fff5f5",border:"1px solid #fca5a5"}}>
                      <div style={{fontSize:11,color:"#9ca3af",marginBottom:4}}>GUEST SIZE</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#c0392b"}}>{user.preferences.guestSizePreference||"—"}</div>
                    </div>
                  </div>

                  {user.preferences.cuisines?.length>0&&(
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:8}}>🍛 Favourite Cuisines</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {user.preferences.cuisines.map(c=><span key={c} style={{padding:"5px 12px",borderRadius:20,background:"#fff5f5",color:"#c0392b",border:"1px solid #fca5a5",fontSize:12,fontWeight:500}}>{c}</span>)}
                      </div>
                    </div>
                  )}

                  {user.preferences.allergies?.length>0&&(
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:8}}>⚠️ Allergies</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {user.preferences.allergies.map(a=><span key={a} style={{padding:"5px 12px",borderRadius:20,background:"#fef2f2",color:"#ef4444",border:"1px solid #fca5a5",fontSize:12,fontWeight:500}}>{a}</span>)}
                      </div>
                    </div>
                  )}

                  {user.preferences.favoriteEventTypes?.length>0&&(
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:"#374151",marginBottom:8}}>🎊 Favourite Event Types</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {user.preferences.favoriteEventTypes.map(e=>{const ev=EVENT_TYPES.find(t=>t.id===e);return <span key={e} style={{padding:"5px 12px",borderRadius:20,background:"#fff5f5",color:"#c0392b",border:"1px solid #fca5a5",fontSize:12,fontWeight:500}}>{ev?.icon} {ev?.label||e}</span>;})}
                      </div>
                    </div>
                  )}
                </div>
              ):(
                <div style={{textAlign:"center",padding:"30px 20px"}}>
                  <div style={{fontSize:40,marginBottom:10}}>🍽️</div>
                  <p style={{fontSize:13,color:"#9ca3af",marginBottom:14}}>No preferences set yet. Tell us what you like!</p>
                  <button onClick={()=>{setShowPreferences(true);setPrefStep(0);}} style={{...S.primaryBtn,width:"auto",padding:"10px 24px",display:"inline-block"}}>Set Preferences →</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ADMIN PANEL (Partner Onboarding)
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="admin"&&user?.isAdmin&&(
        <div style={{...S.page,...anim}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <h2 style={{...S.sectionTitle,marginBottom:0}}>👑 Admin Panel</h2>
            <button onClick={()=>navigate("landing")} style={S.ghostBtn}>← Home</button>
          </div>

          {/* Admin Tabs */}
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {["Partners","Orders","Add Partner"].map(tab=>(
              <button key={tab} onClick={()=>setDbTab(tab.toLowerCase().replace(" ","_"))} style={{...S.ghostBtn,background:dbTab===tab.toLowerCase().replace(" ","_")?"#c0392b":"transparent",color:dbTab===tab.toLowerCase().replace(" ","_")?"#fff":"#6b7280",borderColor:dbTab===tab.toLowerCase().replace(" ","_")?"#c0392b":"#e5e7eb"}}>{tab}</button>
            ))}
          </div>

          {adminLoading&&<div style={{textAlign:"center",padding:40,color:"#6b7280"}}>Loading...</div>}

          {/* Partners List */}
          {dbTab==="partners"&&!adminLoading&&(
            <div>
              <div style={{fontSize:13,color:"#6b7280",marginBottom:12}}>{adminPartners.length} partners registered</div>
              {adminPartners.map(p=>(
                <div key={p.id} style={{...S.card,marginBottom:12,padding:"16px 20px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:20,marginBottom:2}}>{p.logo||"🍽️"} <strong>{p.name}</strong></div>
                      <div style={{fontSize:12,color:"#6b7280"}}>Owner: {p.ownerName} · ☎ {p.phone} · ✉ {p.email}</div>
                      <div style={{fontSize:12,color:"#6b7280"}}>📍 {p.address}, {p.pincode}</div>
                      <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                        {(p.cuisineSpecialties||[]).map(c=><span key={c} style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"#fff5f5",color:"#c0392b",border:"1px solid #fca5a5"}}>{c}</span>)}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <span style={{fontSize:11,padding:"4px 10px",borderRadius:10,background:p.active?"#f0fdf4":"#fef2f2",color:p.active?"#16a34a":"#ef4444",border:`1px solid ${p.active?"#bbf7d0":"#fca5a5"}`}}>{p.active?"Active":"Inactive"}</span>
                      <button onClick={async()=>{await updatePartner(p.id,{active:!p.active});loadAdminData();}} style={{...S.ghostBtn,fontSize:11,padding:"4px 10px"}}>{p.active?"Deactivate":"Activate"}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Orders List */}
          {dbTab==="orders"&&!adminLoading&&(
            <div>
              <div style={{fontSize:13,color:"#6b7280",marginBottom:12}}>{adminOrders.length} orders total</div>
              {adminOrders.map(o=>(
                <div key={o.id} style={{...S.card,marginBottom:12,padding:"16px 20px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#1f2937",marginBottom:4}}>Order #{o.id?.slice(0,8)}</div>
                      <div style={{fontSize:12,color:"#6b7280"}}>Caterer: {o.catererName} · Event: {o.eventType} · Guests: {o.guestCount}</div>
                      <div style={{fontSize:12,color:"#6b7280"}}>Customer: {o.customerEmail||o.customerId}</div>
                      <div style={{fontSize:12,color:"#6b7280"}}>Address: {o.deliveryAddress}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:16,fontWeight:800,color:"#16a34a"}}>₹{o.totalPrice?.toLocaleString()}</div>
                      <span style={{fontSize:11,padding:"3px 8px",borderRadius:8,background:o.status==="Confirmed"?"#f0fdf4":"#fef9c3",color:o.status==="Confirmed"?"#16a34a":"#ca8a04",border:`1px solid ${o.status==="Confirmed"?"#bbf7d0":"#fde68a"}`}}>{o.status}</span>
                    </div>
                  </div>
                </div>
              ))}
              {adminOrders.length===0&&<div style={{textAlign:"center",padding:40,color:"#9ca3af"}}>No orders yet</div>}
            </div>
          )}

          {/* Add Partner Form — Multi-step rich onboarding */}
          {dbTab==="add_partner"&&(
            <div style={S.card}>
              {regSuccess?<div style={{textAlign:"center"}}><div style={{fontSize:60,marginBottom:12}}>✅</div><h3 style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#1f2937",marginBottom:8}}>Partner Added!</h3><p style={{fontSize:13,color:"#6b7280",marginBottom:16}}>All data saved to Firestore for AI ranking & retrieval.</p><button onClick={()=>{setRegSuccess(false);setRegForm({name:"",ownerName:"",phone:"",email:"",address:"",pincode:"",specialty:[],cuisineSpecialties:[],serviceTypes:[],priceRange:"₹₹",turnaround:"2–3 hrs",minGuests:10,maxGuests:500,pricePerPlateMin:150,pricePerPlateMax:800,fssaiLicense:"",yearsInBusiness:"",teamSize:"",signatureDishes:"",description:"",deliveryPincodes:[],menuHighlights:[],vegOnly:false,hasLiveCounter:false,providesDecor:false,providesStaff:true,paymentModes:["Cash","UPI"],cancellationPolicy:"48hrs",availableDays:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]});loadAdminData();setDbTab("partners");}} style={S.primaryBtn}>View Partners</button></div>:(
              <>
                <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:4}}>Add New Partner</h3>
                <p style={{fontSize:12,color:"#9ca3af",marginBottom:16}}>Comprehensive data for AI-powered ranking & matching</p>

                {/* Step indicator */}
                <div style={{display:"flex",gap:6,marginBottom:20}}>
                  {["Basic Info","Services","Capacity & Pricing","Menu & Extras"].map((s,i)=>(
                    <button key={s} onClick={()=>setRegStep(i)} style={{flex:1,padding:"8px 4px",borderRadius:8,border:`1.5px solid ${regStep===i?"#c0392b":"#e5e7eb"}`,background:regStep===i?"#c0392b":i<regStep?"#f0fdf4":"#fff",color:regStep===i?"#fff":i<regStep?"#16a34a":"#6b7280",fontSize:11,fontWeight:regStep===i?700:500,cursor:"pointer",transition:"all 0.2s"}}>
                      {i<regStep?"✓ ":""}{s}
                    </button>
                  ))}
                </div>

                {/* Step 0: Basic Info */}
                {regStep===0&&(
                  <div>
                    <div className="form-grid" style={S.formGrid}>
                      {[["Business Name *","name","e.g. Bhojohori Manna Caterers"],["Owner Name *","ownerName","Full name of owner/manager"],["Phone *","phone","10-digit mobile (WhatsApp)"],["Email *","email","business@email.com"],["Address *","address","Full street address"],["Pincode *","pincode","6-digit Kolkata pincode"]].map(([lbl,key,ph])=>(
                        <div key={key} style={S.fieldWrap}><label style={S.fieldLabel}>{lbl}</label>
                          <input style={{...S.inp2,borderColor:regErrors[key]?"#ef4444":"#e5e7eb"}} value={regForm[key]} onChange={e=>setRegForm({...regForm,[key]:e.target.value})} placeholder={ph}/>
                          {regErrors[key]&&<div style={{fontSize:11,color:"#ef4444"}}>{regErrors[key]}</div>}
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:16}}>
                      <label style={S.fieldLabel}>FSSAI License No. <span style={{color:"#c0392b"}}>*</span> <span style={{color:"#7B634E",fontWeight:400,fontSize:11}}>(mandatory · type "Applied" if pending)</span></label>
                      <input style={{...S.inp2,...(regErrors.fssaiLicense?{borderColor:"#c0392b"}:{})}} value={regForm.fssaiLicense} onChange={e=>setRegForm({...regForm,fssaiLicense:e.target.value})} placeholder='14-digit FSSAI number, or type "Applied"'/>
                      {regErrors.fssaiLicense&&<div style={{color:"#c0392b",fontSize:12,marginTop:4}}>⚠️ {regErrors.fssaiLicense}</div>}
                    </div>
                    <div style={{display:"flex",gap:12,marginTop:12}}>
                      <div style={{flex:1}}><label style={S.fieldLabel}>Years in Business</label>
                        <select value={regForm.yearsInBusiness} onChange={e=>setRegForm({...regForm,yearsInBusiness:e.target.value})} style={{...S.inp2,width:"100%"}}>
                          <option value="">Select</option>{["<1 year","1–3 years","3–5 years","5–10 years","10+ years"].map(y=><option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div style={{flex:1}}><label style={S.fieldLabel}>Team Size</label>
                        <select value={regForm.teamSize} onChange={e=>setRegForm({...regForm,teamSize:e.target.value})} style={{...S.inp2,width:"100%"}}>
                          <option value="">Select</option>{["1–5","5–10","10–20","20–50","50+"].map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{marginTop:16}}>
                      <label style={S.fieldLabel}>Business Description (used for AI matching)</label>
                      <textarea value={regForm.description} onChange={e=>setRegForm({...regForm,description:e.target.value})} placeholder="Describe your catering business, specialties, USP, notable clients..." style={{...S.inp2,minHeight:80,resize:"vertical"}}/>
                    </div>
                  </div>
                )}

                {/* Step 1: Services */}
                {regStep===1&&(
                  <div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Event Types *</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                        {EVENT_TYPES.map(et=><button key={et.id} onClick={()=>setRegForm(f=>({...f,specialty:f.specialty.includes(et.id)?f.specialty.filter(s=>s!==et.id):[...f.specialty,et.id]}))} style={{padding:"8px 16px",borderRadius:10,border:`2px solid ${regForm.specialty.includes(et.id)?"#c0392b":"#e5e7eb"}`,background:regForm.specialty.includes(et.id)?"#fff5f5":"#fff",color:regForm.specialty.includes(et.id)?"#c0392b":"#6b7280",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><span>{et.icon}</span>{et.label}</button>)}
                      </div>
                      {regErrors.specialty&&<div style={{fontSize:11,color:"#ef4444",marginTop:4}}>{regErrors.specialty}</div>}
                    </div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Cuisine Specialties *</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                        {ALL_CUISINES.map(c=><button key={c} onClick={()=>setRegForm(f=>({...f,cuisineSpecialties:f.cuisineSpecialties.includes(c)?f.cuisineSpecialties.filter(s=>s!==c):[...f.cuisineSpecialties,c]}))} style={{padding:"6px 14px",borderRadius:10,border:`1.5px solid ${regForm.cuisineSpecialties.includes(c)?"#c0392b":"#e5e7eb"}`,background:regForm.cuisineSpecialties.includes(c)?"#fff5f5":"#fff",color:regForm.cuisineSpecialties.includes(c)?"#c0392b":"#6b7280",fontSize:12,cursor:"pointer"}}>{c}</button>)}
                      </div>
                      {regErrors.cuisineSpecialties&&<div style={{fontSize:11,color:"#ef4444",marginTop:4}}>{regErrors.cuisineSpecialties}</div>}
                    </div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Service Types *</label>
                      <div style={{display:"flex",gap:8,marginTop:6}}>
                        {Object.values(SVC).map(svc=><button key={svc.id} onClick={()=>setRegForm(f=>({...f,serviceTypes:f.serviceTypes.includes(svc.id)?f.serviceTypes.filter(s=>s!==svc.id):[...f.serviceTypes,svc.id]}))} style={{flex:1,padding:"14px",borderRadius:12,border:`2px solid ${regForm.serviceTypes.includes(svc.id)?svc.color:"#e5e7eb"}`,background:regForm.serviceTypes.includes(svc.id)?svc.grad:"#fff",cursor:"pointer",textAlign:"center"}}><div style={{fontSize:22}}>{svc.icon}</div><div style={{fontSize:12,fontWeight:700,color:svc.color,marginTop:4}}>{svc.label}</div></button>)}
                      </div>
                      {regErrors.serviceTypes&&<div style={{fontSize:11,color:"#ef4444",marginTop:4}}>{regErrors.serviceTypes}</div>}
                    </div>
                    <div>
                      <label style={S.fieldLabel}>Delivery Coverage (Pincodes)</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                        {Object.entries(PINCODE_COORDS).map(([pin,data])=><button key={pin} onClick={()=>setRegForm(f=>({...f,deliveryPincodes:f.deliveryPincodes.includes(pin)?f.deliveryPincodes.filter(p=>p!==pin):[...f.deliveryPincodes,pin]}))} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${regForm.deliveryPincodes.includes(pin)?"#c0392b":"#e5e7eb"}`,background:regForm.deliveryPincodes.includes(pin)?"#fff5f5":"#fff",color:regForm.deliveryPincodes.includes(pin)?"#c0392b":"#6b7280",fontSize:11,cursor:"pointer"}}>{pin} · {data.area}</button>)}
                      </div>
                      <div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>Leave empty = serves all areas</div>
                    </div>
                  </div>
                )}

                {/* Step 2: Capacity & Pricing */}
                {regStep===2&&(
                  <div>
                    <div style={{display:"flex",gap:12,marginBottom:16}}>
                      <div style={{flex:1}}>
                        <label style={S.fieldLabel}>Minimum Guests</label>
                        <input type="number" style={S.inp2} value={regForm.minGuests} onChange={e=>setRegForm({...regForm,minGuests:parseInt(e.target.value)||1})} min={1}/>
                      </div>
                      <div style={{flex:1}}>
                        <label style={S.fieldLabel}>Maximum Guests</label>
                        <input type="number" style={S.inp2} value={regForm.maxGuests} onChange={e=>setRegForm({...regForm,maxGuests:parseInt(e.target.value)||500})} min={10}/>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:12,marginBottom:16}}>
                      <div style={{flex:1}}>
                        <label style={S.fieldLabel}>Price per Plate — MIN (₹)</label>
                        <input type="number" style={S.inp2} value={regForm.pricePerPlateMin} onChange={e=>setRegForm({...regForm,pricePerPlateMin:parseInt(e.target.value)||100})} min={50}/>
                      </div>
                      <div style={{flex:1}}>
                        <label style={S.fieldLabel}>Price per Plate — MAX (₹)</label>
                        <input type="number" style={S.inp2} value={regForm.pricePerPlateMax} onChange={e=>setRegForm({...regForm,pricePerPlateMax:parseInt(e.target.value)||2000})} min={100}/>
                      </div>
                    </div>
                    {regErrors.pricing&&<div style={{fontSize:11,color:"#ef4444",marginBottom:8}}>{regErrors.pricing}</div>}
                    <div style={{display:"flex",gap:12,marginBottom:16}}>
                      <div style={{flex:1}}>
                        <label style={S.fieldLabel}>Preparation Time</label>
                        <select value={regForm.turnaround} onChange={e=>setRegForm({...regForm,turnaround:e.target.value})} style={{...S.inp2,width:"100%"}}>
                          {["1–2 hrs","2–3 hrs","3–4 hrs","4–6 hrs","Same day","Next day"].map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={{flex:1}}>
                        <label style={S.fieldLabel}>Price Tier</label>
                        <select value={regForm.priceRange} onChange={e=>setRegForm({...regForm,priceRange:e.target.value})} style={{...S.inp2,width:"100%"}}>
                          {["₹ (Budget)","₹₹ (Moderate)","₹₹₹ (Premium)","₹₹₹₹ (Luxury)"].map(p=><option key={p} value={p.split(" ")[0]}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Available Days</label>
                      <div style={{display:"flex",gap:6,marginTop:6}}>
                        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><button key={d} onClick={()=>setRegForm(f=>({...f,availableDays:f.availableDays.includes(d)?f.availableDays.filter(x=>x!==d):[...f.availableDays,d]}))} style={{flex:1,padding:"8px 4px",borderRadius:8,border:`1.5px solid ${regForm.availableDays.includes(d)?"#c0392b":"#e5e7eb"}`,background:regForm.availableDays.includes(d)?"#fff5f5":"#fff",color:regForm.availableDays.includes(d)?"#c0392b":"#9ca3af",fontSize:11,fontWeight:600,cursor:"pointer"}}>{d}</button>)}
                      </div>
                    </div>
                    <div>
                      <label style={S.fieldLabel}>Cancellation Policy</label>
                      <select value={regForm.cancellationPolicy} onChange={e=>setRegForm({...regForm,cancellationPolicy:e.target.value})} style={{...S.inp2,width:"100%"}}>
                        {["24hrs","48hrs","72hrs","No refund","Flexible"].map(c=><option key={c} value={c}>{c} notice required</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Step 3: Menu & Extras */}
                {regStep===3&&(
                  <div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Signature Dishes (top 5–10, comma separated)</label>
                      <textarea value={regForm.signatureDishes} onChange={e=>setRegForm({...regForm,signatureDishes:e.target.value})} placeholder="Kosha Mangsho, Chingri Malai Curry, Luchi-Alur Dom, Biryani, Mishti Doi..." style={{...S.inp2,minHeight:60,resize:"vertical"}}/>
                      <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>These are used for AI search & menu matching</div>
                    </div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Menu Categories Offered</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                        {Object.keys(MENU_ITEMS).map(cat=><button key={cat} onClick={()=>setRegForm(f=>({...f,menuHighlights:f.menuHighlights.includes(cat)?f.menuHighlights.filter(c=>c!==cat):[...f.menuHighlights,cat]}))} style={{padding:"6px 14px",borderRadius:10,border:`1.5px solid ${regForm.menuHighlights.includes(cat)?"#c0392b":"#e5e7eb"}`,background:regForm.menuHighlights.includes(cat)?"#fff5f5":"#fff",color:regForm.menuHighlights.includes(cat)?"#c0392b":"#6b7280",fontSize:12,cursor:"pointer"}}>{cat}</button>)}
                      </div>
                    </div>
                    <div style={{marginBottom:16}}>
                      <label style={S.fieldLabel}>Service Features</label>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:6}}>
                        {[{key:"vegOnly",label:"🥬 Vegetarian Only",desc:"Only serves veg food"},{key:"hasLiveCounter",label:"🔥 Live Counters",desc:"Provides live cooking stations"},{key:"providesDecor",label:"🎊 Decoration",desc:"Provides event decoration"},{key:"providesStaff",label:"👨‍🍳 Staff Included",desc:"Serving staff provided"}].map(f=>(
                          <button key={f.key} onClick={()=>setRegForm(r=>({...r,[f.key]:!r[f.key]}))} style={{padding:"12px",borderRadius:10,border:`2px solid ${regForm[f.key]?"#c0392b":"#e5e7eb"}`,background:regForm[f.key]?"#fff5f5":"#fff",cursor:"pointer",textAlign:"left"}}>
                            <div style={{fontSize:13,fontWeight:regForm[f.key]?700:500,color:regForm[f.key]?"#c0392b":"#374151"}}>{f.label}</div>
                            <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{f.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={S.fieldLabel}>Payment Modes Accepted</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                        {["Cash","UPI","Card","Bank Transfer","Cheque"].map(m=><button key={m} onClick={()=>setRegForm(f=>({...f,paymentModes:f.paymentModes.includes(m)?f.paymentModes.filter(x=>x!==m):[...f.paymentModes,m]}))} style={{padding:"6px 14px",borderRadius:10,border:`1.5px solid ${regForm.paymentModes.includes(m)?"#c0392b":"#e5e7eb"}`,background:regForm.paymentModes.includes(m)?"#fff5f5":"#fff",color:regForm.paymentModes.includes(m)?"#c0392b":"#6b7280",fontSize:12,cursor:"pointer"}}>{m}</button>)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div style={{display:"flex",gap:10,marginTop:24}}>
                  {regStep>0&&<button onClick={()=>setRegStep(s=>s-1)} style={{...S.ghostBtn,flex:1,padding:"12px 0"}}>← Back</button>}
                  {regStep<3?(
                    <button onClick={()=>setRegStep(s=>s+1)} style={{...S.primaryBtn,flex:1,marginTop:0}}>Next →</button>
                  ):(
                    <button onClick={submitReg} style={{...S.primaryBtn,flex:1,marginTop:0}}>Add Partner ✅</button>
                  )}
                </div>
              </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LEGAL PAGES
      ══════════════════════════════════════════════════════════════════════ */}
      {view==="privacy"&&(
        <div style={{...S.page,...anim}}>
          <button onClick={()=>navigate("landing")} style={{...S.secondaryBtn,marginBottom:20}}>← Back to Home</button>
          <div style={S.card}>
            <h1 style={{...S.cardTitle,fontSize:22,marginBottom:16}}>Privacy Policy</h1>
            <p style={{fontSize:12,color:"#9ca3af",marginBottom:16}}>Last updated: 29 May 2025</p>
            <div style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.8}}>
              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>1. Information We Collect</h3>
              <p>When you use Aayojan, we may collect:</p>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li>Account information (name, email, phone number) via Google Sign-In or email registration</li>
                <li>Event details you provide (event type, guest count, menu preferences, dietary needs, delivery address, pincode)</li>
                <li>Order history and quotation requests</li>
                <li>Device and browser information for analytics</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>2. How We Use Your Information</h3>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li>To match you with suitable caterers based on your requirements</li>
                <li>To send quotation requests to caterers on your behalf</li>
                <li>To process and fulfill your orders</li>
                <li>To communicate order updates via WhatsApp/email</li>
                <li>To improve our AI matching algorithms</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>3. Data Sharing</h3>
              <p>We share your event requirements (NOT personal contact info) with caterers during the bidding phase. Your identity is revealed to a caterer only after you select them and place an order.</p>
              <p style={{marginTop:8}}>We do NOT sell your data to third parties.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>4. Data Storage</h3>
              <p>Your data is stored securely on Google Firebase (Firestore) servers. We use Firebase Authentication for secure login. Data is retained for as long as your account is active.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>5. Your Rights</h3>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li>Access: Request a copy of your personal data</li>
                <li>Deletion: Request deletion of your account and associated data</li>
                <li>Correction: Update inaccurate information via your profile</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>6. Cookies & Analytics</h3>
              <p>We use Firebase Analytics to understand usage patterns. No third-party advertising cookies are used.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>7. Contact</h3>
              <p>For privacy concerns, email us at: <strong>aayojan1@gmail.com</strong></p>
            </div>
          </div>
        </div>
      )}

      {view==="terms"&&(
        <div style={{...S.page,...anim}}>
          <button onClick={()=>navigate("landing")} style={{...S.secondaryBtn,marginBottom:20}}>← Back to Home</button>
          <div style={S.card}>
            <h1 style={{...S.cardTitle,fontSize:22,marginBottom:16}}>Terms of Service</h1>
            <p style={{fontSize:12,color:"#9ca3af",marginBottom:16}}>Last updated: 30 May 2025</p>
            <div style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.8}}>
              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>1. About Aayojan</h3>
              <p>Aayojan is a technology platform that connects customers with independent caterers across Kolkata. We are a marketplace — we do NOT prepare or serve food ourselves.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>2. User Accounts</h3>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li>You must provide accurate information during registration</li>
                <li>You are responsible for maintaining the security of your account</li>
                <li>One account per person; no shared or bot accounts</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>3. Charges & Fees</h3>
              <p><strong>We believe in transparent pricing with no hidden charges.</strong></p>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li><strong>For Customers:</strong> A small platform fee is charged per booking to cover matching, support, and operations</li>
                <li><strong>Gold Membership (optional):</strong> Customers can subscribe to Gold membership for priority matching, exclusive caterer access, and waived platform fees</li>
                <li><strong>For Partner Caterers:</strong> A flat 3% commission on successfully closed bookings — no joining fee, no monthly subscription, no hidden charges</li>
                <li>Payment for catering services is made directly to the caterer</li>
                <li>Aayojan is not responsible for food quality — that liability rests with the caterer</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>4. Caterer Listings</h3>
              <p>We vet our partner caterers but do not guarantee their services. Ratings, reviews, and match scores are algorithmically generated and meant as guidance, not guarantees.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>5. Cancellation & Refunds</h3>
              <p><strong>Cancellation of bookings is handled directly between the customer and the partner caterer.</strong> Aayojan facilitates the connection but does not manage or guarantee refunds for catering services.</p>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li>Cancellation terms (notice period, refund percentage) are set by each partner caterer individually</li>
                <li>Customers should confirm cancellation terms with their caterer before finalizing the booking</li>
                <li>Aayojan's platform fee is non-refundable once a caterer has been successfully matched and contacted</li>
                <li>If no caterer responds to your inquiry, the platform fee is fully refundable</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>6. Prohibited Use</h3>
              <p>You may not use the platform to harass caterers, submit false orders, scrape data, or circumvent the platform to contact caterers directly for repeat orders.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>7. Limitation of Liability</h3>
              <p>Aayojan's liability is limited to the platform fee charged. We are not liable for food quality, delivery delays, or any damages caused by the caterer's services.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>8. Governing Law</h3>
              <p>These terms are governed by the laws of India. Disputes shall be subject to the jurisdiction of courts in Kolkata, West Bengal.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>9. Contact</h3>
              <p>For questions about these terms: <strong>aayojan1@gmail.com</strong></p>
            </div>
          </div>
        </div>
      )}

      {view==="refund"&&(
        <div style={{...S.page,...anim}}>
          <button onClick={()=>navigate("landing")} style={{...S.secondaryBtn,marginBottom:20}}>← Back to Home</button>
          <div style={S.card}>
            <h1 style={{...S.cardTitle,fontSize:22,marginBottom:16}}>Refund & Cancellation Policy</h1>
            <p style={{fontSize:12,color:"#9ca3af",marginBottom:16}}>Last updated: 30 May 2025</p>
            <div style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.8}}>
              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>Our Charging Model</h3>
              <p><strong>Aayojan keeps it simple and transparent:</strong></p>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li><strong>Customers:</strong> Platform fee per booking (covers AI matching, support & coordination)</li>
                <li><strong>Customers (optional):</strong> Gold Membership for priority access, exclusive caterers, and waived platform fees</li>
                <li><strong>Partner Caterers:</strong> 3% commission on successful bookings only — no other charges</li>
              </ul>
              <p style={{marginTop:8,fontWeight:600}}>No hidden charges. No surprises. That's a promise.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>Booking Cancellations</h3>
              <p><strong>All booking cancellations are handled directly between the customer and the partner caterer.</strong></p>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li>Each caterer sets their own cancellation terms (notice period, refund eligibility, penalties)</li>
                <li>Customers should confirm cancellation terms with their caterer before placing the booking</li>
                <li>Aayojan does not hold catering payments and cannot process refunds on behalf of caterers</li>
                <li>If a dispute arises, Aayojan will make reasonable efforts to mediate but is not liable for outcomes</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>Platform Fee Refund</h3>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li><strong>No caterer responded to your inquiry:</strong> Full refund of platform fee</li>
                <li><strong>You cancel before any caterer is matched:</strong> Full refund</li>
                <li><strong>After a caterer has been matched and contacted:</strong> Platform fee is non-refundable (the service has been delivered)</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>Gold Membership</h3>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li>Gold Membership is a recurring subscription and can be cancelled anytime</li>
                <li>No refund for the current billing period upon cancellation</li>
                <li>Benefits remain active until the end of the paid period</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>How to Reach Us</h3>
              <p>For any refund requests or disputes, email <strong>aayojan1@gmail.com</strong> or WhatsApp us at <strong>+91 8088434425</strong>. We respond within 24 hours.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── ABOUT US PAGE ────────────────────────────────────────── */}
      {view==="about"&&(
        <div style={{...anim,overflowX:"hidden"}}>
          {/* About Hero */}
          <section style={{background:"var(--bg-primary)",padding:"6rem 5% 5rem",textAlign:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:"-120px",left:"50%",transform:"translateX(-50%)",width:700,height:400,background:"radial-gradient(ellipse, rgba(192,57,43,0.12) 0%, transparent 65%)",pointerEvents:"none"}}/>
            <div style={{display:"inline-block",background:"rgba(192,57,43,0.12)",color:"var(--text-accent)",border:"1px solid rgba(192,57,43,0.3)",padding:"0.3rem 1rem",borderRadius:100,fontSize:"0.8rem",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"1.5rem"}}>🍛 About Aayojan</div>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(2.4rem, 5vw, 4rem)",fontWeight:900,color:"var(--text-primary)",lineHeight:1.15,maxWidth:700,margin:"0 auto 1.5rem"}}> Connecting Kolkata's <em style={{fontStyle:"italic",color:"var(--text-accent)"}}>best caterers</em> with people who need them</h1>
            <p style={{color:"var(--text-secondary)",fontSize:"1.05rem",maxWidth:560,margin:"0 auto",lineHeight:1.75}}>An AI-powered catering platform built for all of Kolkata — making it effortless for customers to find trusted caterers, and for caterers to grow their business.</p>
            <div style={{marginTop:"3.5rem",display:"flex",justifyContent:"center",gap:"1.5rem",flexWrap:"wrap"}}>
              {["📍 Newtown, Kolkata","🤝 Partner-first platform","🤖 AI-powered matching","🎉 Weddings to office lunches"].map(pill=>(
                <div key={pill} style={{background:"var(--bg-card)",border:"1px solid var(--border-default)",color:"var(--text-secondary)",padding:"0.5rem 1.2rem",borderRadius:100,fontSize:"0.85rem",display:"flex",alignItems:"center",gap:"0.4rem"}}>{pill}</div>
              ))}
            </div>
          </section>

          {/* Why We Built This */}
          <section style={{padding:"5rem 5%",background:"var(--bg-secondary)"}}>
            <div style={{maxWidth:1000,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:"3rem"}}>
                <div style={{color:"var(--text-accent)",fontWeight:600,fontSize:"0.8rem",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"1rem"}}>Why We Built This</div>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(1.8rem,3vw,2.6rem)",fontWeight:900,lineHeight:1.2,color:"var(--text-primary)"}}>Two real problems. <span style={{color:"var(--text-accent)"}}>One platform.</span></h2>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.5rem",marginBottom:"1.5rem"}}>
                {/* Customer Pain */}
                <div style={{background:"var(--bg-card)",border:"1px solid var(--border-default)",borderRadius:20,padding:"2rem",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#c0392b,#e74c3c)"}}/>
                  <div style={{fontSize:"1.8rem",marginBottom:"0.8rem"}}>🙋</div>
                  <div style={{color:"var(--text-accent)",fontSize:"0.75rem",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"0.5rem"}}>Customer Pain</div>
                  <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.1rem",fontWeight:700,color:"var(--text-primary)",marginBottom:"1rem"}}>Booking a caterer felt like guesswork</h3>
                  <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:"0.6rem"}}>
                    {["Days spent chasing referrals on WhatsApp","No way to compare quality or pricing","Booking blind with no verified reviews","Quotes took days — or never came at all"].map(item=>(
                      <li key={item} style={{display:"flex",alignItems:"flex-start",gap:"0.6rem",color:"var(--text-secondary)",fontSize:"0.88rem"}}><span style={{color:"var(--text-accent)",marginTop:2}}>✕</span> {item}</li>
                    ))}
                  </ul>
                </div>
                {/* Partner Pain */}
                <div style={{background:"var(--bg-card)",border:"1px solid var(--border-default)",borderRadius:20,padding:"2rem",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#16a34a,#4ade80)"}}/>
                  <div style={{fontSize:"1.8rem",marginBottom:"0.8rem"}}>🍳</div>
                  <div style={{color:"#16a34a",fontSize:"0.75rem",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"0.5rem"}}>Partner Pain</div>
                  <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.1rem",fontWeight:700,color:"var(--text-primary)",marginBottom:"1rem"}}>Great caterers were invisible to new customers</h3>
                  <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:"0.6rem"}}>
                    {["100% dependent on word-of-mouth referrals","Empty calendars in off-peak seasons","No digital presence or customer pipeline","No platform built for how they work"].map(item=>(
                      <li key={item} style={{display:"flex",alignItems:"flex-start",gap:"0.6rem",color:"var(--text-secondary)",fontSize:"0.88rem"}}><span style={{color:"var(--text-accent)",marginTop:2}}>✕</span> {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {/* Aayojan Fix */}
              <div style={{background:"var(--bg-card)",border:"2px solid var(--border-accent)",borderRadius:20,padding:"2rem 2.5rem",display:"grid",gridTemplateColumns:"auto 1fr",gap:"2rem",alignItems:"center",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:"50%",right:-60,transform:"translateY(-50%)",width:250,height:250,background:"radial-gradient(circle, rgba(192,57,43,0.08), transparent 70%)",pointerEvents:"none"}}/>
                <div style={{textAlign:"center"}}><div style={{fontSize:"2.5rem"}}>⚡</div></div>
                <div>
                  <div style={{color:"var(--text-accent)",fontSize:"0.75rem",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"0.5rem"}}>The Aayojan Fix</div>
                  <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.15rem",fontWeight:700,color:"var(--text-primary)",marginBottom:"0.8rem"}}>We put both sides on one platform and let AI bridge the gap</h3>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"0.6rem"}}>
                    {["✓ Verified caterer network","✓ Quotes in 48 hours","✓ Leads on WhatsApp","✓ Free for customers","✓ Zero joining fee"].map(tag=>(
                      <span key={tag} style={{background:"rgba(192,57,43,0.08)",border:"1px solid rgba(192,57,43,0.2)",color:"var(--text-accent)",padding:"0.3rem 0.9rem",borderRadius:100,fontSize:"0.82rem"}}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Numbers */}
          <section style={{background:"var(--bg-accent-light)",padding:"5rem 5%"}}>
            <div style={{textAlign:"center",marginBottom:"3rem"}}>
              <div style={{color:"var(--text-accent)",fontWeight:600,fontSize:"0.8rem",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"0.8rem"}}>By the Numbers</div>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(1.8rem,3vw,2.6rem)",fontWeight:700,color:"var(--text-primary)"}}>Aayojan at a glance</h2>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"2rem",maxWidth:900,margin:"0 auto",textAlign:"center"}}>
              {[{val:"Kolkata",label:"Serving all over\nall over Kolkata"},{val:"48h",label:"Guaranteed quote\ndelivery time"},{val:"₹0",label:"Cost to join\nfor catering partners"},{val:"5+",label:"Cuisine types\nacross our network"}].map(n=>(
                <div key={n.val}>
                  <span style={{fontFamily:"'Playfair Display',serif",fontSize:"2.8rem",fontWeight:900,color:"var(--text-accent)",display:"block",lineHeight:1,marginBottom:"0.4rem"}}>{n.val}</span>
                  <div style={{color:"var(--text-secondary)",fontSize:"0.88rem",lineHeight:1.5,whiteSpace:"pre-line"}}>{n.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Mission & Values */}
          <section style={{background:"var(--bg-primary)",padding:"6rem 5%"}}>
            <div style={{textAlign:"center",marginBottom:"3.5rem"}}>
              <div style={{color:"var(--text-accent)",fontWeight:600,fontSize:"0.8rem",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"0.8rem"}}>What We Stand For</div>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(1.8rem,3vw,2.6rem)",fontWeight:700,color:"var(--text-primary)",marginBottom:"0.8rem"}}>Our mission & values</h2>
              <p style={{color:"var(--text-secondary)",fontSize:"0.97rem",maxWidth:500,margin:"0 auto",lineHeight:1.7}}>We're building a platform where both customers and caterers come away better off every time.</p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1.5rem",maxWidth:1000,margin:"0 auto"}}>
              {[
                {icon:"🤝",title:"Partner-First",desc:"Caterers are not suppliers — they're our partners. We only succeed when they grow. Every product decision is filtered through this lens."},
                {icon:"🔍",title:"Radical Transparency",desc:"No hidden fees, no buried clauses. Customers know exactly what they're getting; partners know exactly what they'll pay."},
                {icon:"⚡",title:"Speed Over Perfection",desc:"A quote delivered in 48 hours beats a perfect quote that takes a week. We obsess over reducing friction at every step."},
                {icon:"📍",title:"Deeply Local",desc:"We're not trying to solve catering globally. We're building something that works brilliantly for Kolkata first."},
                {icon:"🌱",title:"Grow Together",desc:"Our commission model means we only earn when our partners earn. Aligned incentives create better outcomes for everyone."},
                {icon:"🍱",title:"Food is Culture",desc:"Bengali wedding food is not just a meal — it's memory. We treat every event we support as something meaningful, not transactional."},
              ].map(v=>(
                <div key={v.title} style={{background:"var(--bg-card)",border:"1px solid var(--border-default)",borderRadius:18,padding:"2rem",transition:"border-color 0.2s, transform 0.2s",cursor:"default"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(192,57,43,0.4)";e.currentTarget.style.transform="translateY(-4px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border-default)";e.currentTarget.style.transform="translateY(0)";}}>
                  <span style={{fontSize:"2.2rem",marginBottom:"1.2rem",display:"block"}}>{v.icon}</span>
                  <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:"1.1rem",fontWeight:700,color:"var(--text-primary)",marginBottom:"0.6rem"}}>{v.title}</h3>
                  <p style={{color:"var(--text-secondary)",fontSize:"0.88rem",lineHeight:1.7}}>{v.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Team */}
          <section style={{padding:"6rem 5%",background:"var(--bg-secondary)"}}>
            <div style={{maxWidth:700,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:"3.5rem"}}>
                <div style={{color:"var(--text-accent)",fontWeight:600,fontSize:"0.8rem",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"0.8rem"}}>The People</div>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(1.8rem,3vw,2.6rem)",fontWeight:700,color:"var(--text-primary)",marginBottom:"0.8rem"}}>Meet the team</h2>
                <p style={{color:"var(--text-secondary)",fontSize:"0.97rem",maxWidth:500,margin:"0 auto",lineHeight:1.7}}>A small team with deep roots in Kolkata and a shared obsession with making catering discovery effortless.</p>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"2rem"}}>
                {[
                  {initials:"S",name:"Suparna",role:"Operations & Customer Experience",bio:"IT Consultant at a top leading MNC with 16 years of experience across international markets. Her deep expertise in customer-facing challenges gives Aayojan its edge in understanding what both customers and partners truly need.",gradient:"linear-gradient(135deg, #2D1A06, #6B3A10)"},
                  {initials:"G",name:"Gourav",role:"Technology Advisor",bio:"Principal Engineer at a leading MNC with 17 years of experience across international projects. Holder of multiple patents and published journals, Gourav advises Aayojan on AI architecture and technology strategy in an advisory capacity.",gradient:"linear-gradient(135deg, #1A0A2D, #4A1A6B)"},
                ].map(m=>(
                  <div key={m.initials} style={{background:"var(--bg-card)",border:"1px solid var(--border-default)",borderRadius:20,overflow:"hidden",transition:"transform 0.2s, box-shadow 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-5px)";e.currentTarget.style.boxShadow="0 16px 50px rgba(192,57,43,0.12)";}} onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}>
                    <div style={{height:180,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"4rem",background:m.gradient}}>
                      <div style={{width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:"2rem",fontWeight:900,color:"white",border:"2px solid rgba(255,255,255,0.2)"}}>{m.initials}</div>
                    </div>
                    <div style={{padding:"1.5rem"}}>
                      <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.15rem",fontWeight:700,color:"var(--text-primary)",marginBottom:"0.2rem"}}>{m.name}</div>
                      <div style={{color:"var(--text-accent)",fontSize:"0.8rem",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"0.8rem"}}>{m.role}</div>
                      <p style={{color:"var(--text-secondary)",fontSize:"0.88rem",lineHeight:1.65}}>{m.bio}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section style={{background:"var(--bg-card)",padding:"6rem 5%",textAlign:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:600,height:300,background:"radial-gradient(ellipse, rgba(192,57,43,0.08), transparent 70%)",pointerEvents:"none"}}/>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(2rem, 4vw, 3rem)",fontWeight:900,color:"var(--text-primary)",maxWidth:620,margin:"0 auto 1.2rem",position:"relative"}}>Ready to be part of the <span style={{color:"var(--text-accent)"}}>Aayojan story?</span></h2>
            <p style={{color:"var(--text-secondary)",fontSize:"0.97rem",maxWidth:480,margin:"0 auto 2.5rem",lineHeight:1.7,position:"relative"}}>Whether you're a customer planning your next big event or a caterer looking to grow — we'd love to have you with us.</p>
            <div style={{display:"flex",gap:"1rem",justifyContent:"center",flexWrap:"wrap",position:"relative"}}>
              <button onClick={()=>navigate("partner-terms")} style={{background:"linear-gradient(135deg,#c0392b,#e74c3c)",color:"white",padding:"0.9rem 2rem",borderRadius:8,fontWeight:600,fontSize:"0.97rem",border:"none",cursor:"pointer",transition:"transform 0.1s"}} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>🍽️ Join as a Partner</button>
              <button onClick={()=>navigate("landing")} style={{border:"1.5px solid var(--border-default)",color:"var(--text-primary)",padding:"0.9rem 2rem",borderRadius:8,fontWeight:500,fontSize:"0.97rem",background:"transparent",cursor:"pointer",transition:"border-color 0.2s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--text-accent)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border-default)"}>Find a Caterer →</button>
            </div>
          </section>

          {/* Footer */}
          <footer style={{textAlign:"center",padding:"2rem",color:"var(--text-muted)",fontSize:"0.85rem",borderTop:"1px solid var(--border-default)"}}>
            <p>© 2025 Aayojan Technologies (UDYAM-WB-14-0277694) — <span style={{cursor:"pointer",color:"var(--text-accent)"}} onClick={()=>navigate("landing")}>aayojan.online</span> · Newtown, Kolkata · <span style={{cursor:"pointer",color:"var(--text-accent)"}} onClick={()=>navigate("partner-terms")}>Partner with Us</span></p>
          </footer>
        </div>
      )}

      {/* ── PARTNER LANDING PAGE ─────────────────────────────────── */}
      {view==="partner-terms"&&(
        <div style={{...S.page,...anim}}>
          <button onClick={()=>navigate("landing")} style={{...S.secondaryBtn,marginBottom:20}}>← Back to Home</button>
          
          {/* Hero Banner — Partner Pitch */}
          <div style={{background:"linear-gradient(135deg,#FF6B35 0%,#D4380D 50%,#8B1A00 100%)",borderRadius:16,padding:"48px 24px",textAlign:"center",marginBottom:24,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",inset:0,background:"url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=60')",backgroundSize:"cover",opacity:0.12}}/>
            <div style={{position:"relative",zIndex:1}}>
              <div style={{display:"inline-block",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:20,padding:"6px 16px",marginBottom:16}}>
                <span style={{fontSize:12,color:"#fff",fontWeight:600}}>🎯 FOR CATERERS IN NEWTOWN, SALT LAKE & RAJARHAT</span>
              </div>
              <h1 style={{fontSize:"clamp(26px,5vw,40px)",fontWeight:900,color:"#fff",marginBottom:12,fontFamily:"'Playfair Display',serif",lineHeight:1.2}}>Get 15–30 Qualified Leads<br/><span style={{color:"#FDE68A"}}>Every Month — Free</span></h1>
              <p style={{fontSize:16,color:"rgba(255,255,255,0.9)",marginBottom:6}}>We bring customers to you via WhatsApp. You cook, we market.</p>
              <p style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginBottom:24}}>Zero listing fee · Zero upfront cost · Pay only 3% when you earn</p>
              <a href="https://wa.me/918088434425?text=Hi%20Aayojan!%20I%20am%20a%20caterer%20and%20want%20to%20join%20as%20partner" target="_blank" rel="noopener noreferrer" style={{display:"inline-block",background:"#fff",color:"#D4380D",padding:"16px 36px",borderRadius:30,fontSize:16,fontWeight:800,textDecoration:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.2)"}}>
                📱 Register Free on WhatsApp →
              </a>
              <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:12}}>Takes 2 minutes · No app download needed</p>
            </div>
          </div>

          {/* Social Proof — Partner Numbers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:24}} className="feat-grid">
            {[
              {num:"12",label:"Caterers Onboarded",icon:"👨‍🍳"},
              {num:"500+",label:"Events Capacity/Month",icon:"🎉"},
              {num:"48hr",label:"Avg Lead Response",icon:"⚡"},
              {num:"₹80K+",label:"Revenue/Partner/Month",icon:"💰"}
            ].map((s,i)=>(
              <div key={i} style={{background:"var(--bg-card)",border:"1px solid var(--border-light)",borderRadius:14,padding:"16px 10px",textAlign:"center"}}>
                <div style={{fontSize:24,marginBottom:4}}>{s.icon}</div>
                <div style={{fontSize:20,fontWeight:900,color:"var(--text-primary)"}}>{s.num}</div>
                <div style={{fontSize:10,color:"var(--text-secondary)",marginTop:2}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* What You Get — Clear Value Prop */}
          <div style={{...S.card,marginBottom:20}}>
            <h2 style={{fontSize:20,fontWeight:800,color:"var(--text-primary)",marginBottom:6}}>What You Get as a Partner</h2>
            <p style={{fontSize:13,color:"var(--text-secondary)",marginBottom:20}}>Everything a caterer needs to grow — no tech skills required</p>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {[
                {icon:"📲",title:"Direct WhatsApp Leads",desc:"Customers contact you directly on WhatsApp. No middleman, no app, no login."},
                {icon:"📸",title:"Professional Listing Page",desc:"We photograph your food, write your menu, and create a beautiful profile that sells."},
                {icon:"🎯",title:"AI-Matched Customers",desc:"Our AI sends you ONLY relevant leads — right budget, right area, right cuisine type."},
                {icon:"📊",title:"Monthly Performance Report",desc:"See how many leads you got, conversion rate, and revenue. Data-driven growth."},
                {icon:"🏆",title:"Verified Badge & Reviews",desc:"Build trust with verified reviews from real customers. Stand out from competition."},
                {icon:"📢",title:"We Do the Marketing",desc:"Google Ads, SEO, social media, WhatsApp campaigns — all handled by us. You focus on cooking."}
              ].map((item,i)=>(
                <div key={i} style={{display:"flex",gap:14,alignItems:"flex-start",background:"var(--bg-secondary)",borderRadius:12,padding:"14px 16px"}}>
                  <span style={{fontSize:28,flexShrink:0}}>{item.icon}</span>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--text-primary)",marginBottom:3}}>{item.title}</div>
                    <div style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.6}}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How It Works for Caterers */}
          <div style={{...S.card,marginBottom:20}}>
            <h2 style={{fontSize:18,fontWeight:800,color:"var(--text-primary)",marginBottom:16}}>How It Works — 3 Simple Steps</h2>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {[
                {step:"1",title:"Register (2 min)",desc:"Send us your menu, photos & service area on WhatsApp. We create your profile."},
                {step:"2",title:"Get Leads on WhatsApp",desc:"When a customer in your area needs catering, we send their request directly to your WhatsApp."},
                {step:"3",title:"Cook & Get Paid",desc:"You quote your price, confirm the order, deliver food. Customer pays you directly."}
              ].map((item,i)=>(
                <div key={i} style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#FF6B35,#D4380D)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,fontWeight:900,flexShrink:0}}>{item.step}</div>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>{item.title}</div>
                    <div style={{fontSize:12,color:"var(--text-secondary)"}}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Partner Testimonials */}
          <div style={{...S.card,marginBottom:20}}>
            <h2 style={{fontSize:18,fontWeight:800,color:"var(--text-primary)",marginBottom:16}}>What Our Partners Say</h2>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {[
                {name:"Raju's Kitchen, Newtown",quote:"Got 8 orders in my first month. The leads are genuine — people actually want to order, not just enquire.","orders":"18 orders"},
                {name:"Maa Annapurna Catering, Rajarhat",quote:"I was spending ₹5000/month on pamphlets. Now I get better leads for free through Aayojan.","orders":"12 orders"},
                {name:"Bengali Bite, Action Area II",quote:"The food tasting concept is genius — customers try before booking. My conversion rate doubled.","orders":"22 orders"}
              ].map((t,i)=>(
                <div key={i} style={{background:"var(--bg-secondary)",borderRadius:12,padding:"16px",borderLeft:"4px solid #FF6B35"}}>
                  <div style={{fontSize:12,color:"var(--text-secondary)",fontStyle:"italic",lineHeight:1.7,marginBottom:10}}>"{t.quote}"</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>{t.name}</div>
                    </div>
                    <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:600,color:"#16A34A"}}>{t.orders}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Launch Offer Card */}
          <div style={{background:"linear-gradient(135deg,#FFF7ED,#FEF3C7)",border:"2px solid #F59E0B",borderRadius:16,padding:24,marginBottom:20,textAlign:"center",position:"relative"}}>
            <div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:"#F59E0B",color:"#fff",fontSize:11,fontWeight:700,padding:"4px 16px",borderRadius:20}}>🚀 FOUNDING PARTNER PROGRAM</div>
            <h2 style={{fontSize:20,fontWeight:700,color:"#92400E",marginTop:8,marginBottom:6}}>First 10 Partners — 0% Commission · Year One</h2>
            <p style={{fontSize:13,color:"#92400E",marginBottom:16}}>15+ kitchens already in our network · <strong>0% commission for early partners</strong>. No monthly fees, ever.</p>
            <div style={{display:"flex",justifyContent:"center",gap:16,flexWrap:"wrap"}}>
              <div style={{background:"#fff",borderRadius:12,padding:"12px 20px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
                <div style={{fontSize:24,fontWeight:800,color:"#16A34A"}}>₹0</div>
                <div style={{fontSize:11,color:"#666"}}>Onboarding Fee</div>
              </div>
              <div style={{background:"#fff",borderRadius:12,padding:"12px 20px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
                <div style={{fontSize:24,fontWeight:800,color:"#16A34A"}}>₹0</div>
                <div style={{fontSize:11,color:"#666"}}>Listing Fee</div>
              </div>
              <div style={{background:"#fff",borderRadius:12,padding:"12px 20px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
                <div style={{fontSize:24,fontWeight:800,color:"#16A34A"}}>0%</div>
                <div style={{fontSize:11,color:"#666"}}>Commission</div>
              </div>
            </div>
          </div>

          {/* Commission Structure (for after 10 partners) */}
          <div style={{...S.card,marginBottom:20}}>
            <h2 style={{fontSize:18,fontWeight:700,color:"var(--text-primary)",marginBottom:6}}>💰 Pricing After Launch Offer</h2>
            <p style={{fontSize:12,color:"var(--text-secondary)",marginBottom:16}}>Only applies to partners who join after first 10 spots are filled</p>

            <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:12,padding:16,marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:600,color:"#166534",marginBottom:8}}>📦 First 10 Orders</div>
              <div style={{fontSize:28,fontWeight:800,color:"#16A34A"}}>3% <span style={{fontSize:14,fontWeight:400,color:"#666"}}>per successful order</span></div>
              <p style={{fontSize:12,color:"#666",marginTop:8}}>Only charged when customer pays you. No order = No charge. Zero risk.</p>
            </div>

            <div style={{fontSize:14,fontWeight:600,color:"var(--text-primary)",marginBottom:12,textAlign:"center"}}>After 10 orders, choose:</div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{background:"linear-gradient(135deg,#FEF9C3,#FDE68A)",border:"2px solid #F59E0B",borderRadius:12,padding:16,textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#92400E",marginBottom:4}}>⭐ GOLD MEMBERSHIP</div>
                <div style={{fontSize:24,fontWeight:800,color:"#92400E"}}>₹3,999</div>
                <div style={{fontSize:11,color:"#92400E"}}>/year (₹333/mo)</div>
                <div style={{marginTop:12,fontSize:11,color:"#666",lineHeight:1.6}}>
                  ✅ 0% commission<br/>
                  ✅ Priority listing<br/>
                  ✅ Gold badge ⭐<br/>
                  ✅ Homepage feature
                </div>
              </div>
              <div style={{background:"#F9FAFB",border:"1px solid #E5E7EB",borderRadius:12,padding:16,textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#6B7280",marginBottom:4}}>PAY AS YOU GO</div>
                <div style={{fontSize:24,fontWeight:800,color:"#374151"}}>3%</div>
                <div style={{fontSize:11,color:"#6B7280"}}>per order (continues)</div>
                <div style={{marginTop:12,fontSize:11,color:"#666",lineHeight:1.6}}>
                  ✅ No annual fee<br/>
                  ✅ Standard listing<br/>
                  ✅ Cancel anytime<br/>
                  ✅ No commitment
                </div>
              </div>
            </div>
          </div>

          {/* FAQ for Partners */}
          <div style={{...S.card,marginBottom:20}}>
            <h2 style={{fontSize:18,fontWeight:800,color:"var(--text-primary)",marginBottom:16}}>❓ Partner FAQ</h2>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {[
                {q:"How do I receive leads?",a:"Directly on your WhatsApp. Customer's name, event type, guest count, and budget — all sent to you instantly."},
                {q:"Do I need to download an app?",a:"No. Everything works on WhatsApp. No app, no login, no tech hassle."},
                {q:"What if I don't get any orders?",a:"You pay nothing. Zero fixed cost. Commission is only 3% of orders you actually complete."},
                {q:"Can I set my own prices?",a:"Yes, 100%. You quote your own rates. We never force discounts or price matching."},
                {q:"What areas do you cover?",a:"All over Kolkata, Action Area I-III & beyond."},
                {q:"Is there an exclusivity requirement?",a:"No. You can be on other platforms too. We just ask that you respond to leads within 2 hours."},
                {q:"How do I get paid?",a:"Customer pays you directly — cash, UPI, bank transfer. Aayojan invoices the 3% monthly."},
                {q:"What's the food tasting programme?",a:"Customers pay ₹199-399 to taste your food before booking. You keep the tasting fee. If they book, it's adjusted against the order."}
              ].map((item,i)=>(
                <div key={i} style={{borderBottom:"1px solid var(--border-light)",paddingBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:4}}>{item.q}</div>
                  <div style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.6}}>{item.a}</div>
                </div>
              ))}
            </div>
          </div>

          {/* About / Trust Signals */}
          <div style={{...S.card,marginBottom:20,background:"linear-gradient(135deg,var(--bg-card),var(--bg-secondary))"}}>
            <h2 style={{fontSize:18,fontWeight:800,color:"var(--text-primary)",marginBottom:12}}>About Aayojan</h2>
            <div style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.8,marginBottom:16}}>
              <p style={{marginBottom:12}}>Aayojan (আয়োজন — "The Celebration") is Kolkata's first AI-powered catering aggregator, built by <strong>Suparna</strong> — a Newtown resident who saw how difficult it is to find good caterers for events.</p>
              <p style={{marginBottom:12}}>We started in May 2025 with a simple mission: <strong>make finding the right caterer as easy as ordering food online.</strong> No more calling 10 numbers, no more uncertainty about quality.</p>
              <p>Based in Newtown, Kolkata · Registered business · Built with love for Bengali food & celebrations 🎉</p>
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {["📍 Newtown, Kolkata","🏢 Registered Business","🔒 Data Protected","📱 WhatsApp-First"].map(t=>(
                <span key={t} style={{background:"var(--bg-card)",border:"1px solid var(--border-light)",borderRadius:8,padding:"6px 12px",fontSize:11,color:"var(--text-secondary)"}}>{t}</span>
              ))}
            </div>
          </div>

          {/* Referral Programme */}
          <div style={{background:"linear-gradient(135deg,#EDE9FE,#DDD6FE)",border:"2px solid #8B5CF6",borderRadius:16,padding:24,marginBottom:20,textAlign:"center"}}>
            <div style={{fontSize:36,marginBottom:8}}>🎁</div>
            <h2 style={{fontSize:18,fontWeight:700,color:"#5B21B6",marginBottom:8}}>Refer Another Caterer</h2>
            <p style={{fontSize:14,color:"#6D28D9",marginBottom:12}}>Refer a caterer friend → <strong>Your next order is commission-FREE!</strong></p>
            <div style={{background:"#fff",borderRadius:10,padding:12,fontSize:12,color:"#666",lineHeight:1.6}}>
              Example: You refer "ABC Caterers" → They join Aayojan → Your very next order = 0% commission (you keep 100%)
            </div>
          </div>

          {/* Final CTA */}
          <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",borderRadius:16,padding:"36px 24px",textAlign:"center",marginBottom:32}}>
            <h2 style={{fontSize:22,fontWeight:800,color:"#fff",marginBottom:8}}>Ready to Grow Your Business?</h2>
            <p style={{fontSize:14,color:"rgba(255,255,255,0.7)",marginBottom:20}}>Join our growing network of 15+ Bengali kitchens · 0% for early partners</p>
            <a href="https://wa.me/918088434425?text=Hi%20Aayojan!%20I%20am%20a%20caterer%20in%20Newtown%2FSalt%20Lake%2FRajarhat%20and%20want%20to%20join%20as%20partner.%20My%20business%20name%20is%3A%20" target="_blank" rel="noopener noreferrer" style={{display:"inline-block",background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",padding:"16px 36px",borderRadius:30,fontSize:16,fontWeight:700,textDecoration:"none",boxShadow:"0 4px 16px rgba(37,211,102,0.3)",marginBottom:12}}>
              📱 Register Free — WhatsApp Us
            </a>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Or call: +91-8088434425 · Takes 2 minutes</p>
            <div style={{marginTop:16,display:"flex",justifyContent:"center",gap:16,flexWrap:"wrap"}}>
              {["✅ Free to join","✅ No app needed","✅ Leads on WhatsApp","✅ Pay only when you earn"].map(t=>(
                <span key={t} style={{fontSize:11,color:"rgba(255,255,255,0.7)"}}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer style={{textAlign:"center",marginTop:44,padding:"20px 20px 0",borderTop:"2px solid #fde8d8",fontSize:12,color:"#9ca3af",letterSpacing:"0.04em"}}>
        <div style={{fontSize:18,letterSpacing:10,color:"#fca5a5",marginBottom:6}}>✦ ✦ ✦ ✦ ✦</div>
        Aayojan © 2025 · Newtown, Kolkata · আয়োজন
        <div style={{marginTop:8,display:"flex",justifyContent:"center",gap:16,flexWrap:"wrap"}}>
          <button onClick={()=>navigate("privacy")} style={{background:"none",border:"none",color:"#9ca3af",fontSize:11,cursor:"pointer",textDecoration:"underline"}}>Privacy Policy</button>
          <button onClick={()=>navigate("terms")} style={{background:"none",border:"none",color:"#9ca3af",fontSize:11,cursor:"pointer",textDecoration:"underline"}}>Terms of Service</button>
          <button onClick={()=>navigate("refund")} style={{background:"none",border:"none",color:"#9ca3af",fontSize:11,cursor:"pointer",textDecoration:"underline"}}>Refund Policy</button>
          <button onClick={()=>navigate("about")} style={{background:"none",border:"none",color:"#FF6B35",fontSize:11,cursor:"pointer",textDecoration:"underline",fontWeight:600}}>About Us</button>
          <a href="/partners.html" style={{color:"#FF6B35",fontSize:11,textDecoration:"underline",fontWeight:600}}>Partner with Us</a>
          <a href="/faq.html" style={{color:"#9ca3af",fontSize:11,textDecoration:"underline"}}>FAQ</a>
        </div>
      </footer>

      {/* Floating AI Chat Bot (bottom-left) */}
      <AayojanChatBot />

      {/* Floating WhatsApp Button */}
      <a href="https://wa.me/918088434425?text=Hi%20Aayojan!%20I%20need%20catering%20help" target="_blank" rel="noopener noreferrer" style={{position:"fixed",bottom:24,right:24,width:56,height:56,borderRadius:"50%",background:"#25D366",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 16px rgba(37,211,102,0.4)",zIndex:200,transition:"transform 0.2s",textDecoration:"none"}}>
        <span style={{fontSize:28}}>💬</span>
      </a>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box;margin:0;padding:0; }
        body { background:#fef9f7; }
        input[type=range]{-webkit-appearance:none;appearance:none;height:5px;border-radius:3px;background:#fde8d8;outline:none;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;cursor:pointer;box-shadow:0 2px 8px rgba(192,57,43,0.25);}
        @keyframes loadSlide{from{width:0%}to{width:90%}}
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        @keyframes pgSpin{to{transform:rotate(360deg)}}
        @keyframes heroSlide{0%,15%{opacity:1}20%,95%{opacity:0}100%{opacity:0}}
        @keyframes fadeSlideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes floatUp{from{transform:translateY(0) scale(1);opacity:0.3}to{transform:translateY(-40px) scale(1.5);opacity:0.6}}
        @keyframes bounceDown{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(8px)}}
        @keyframes scrollDot{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(10px)}}
        @keyframes scrollRibbon{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes heroGlowA{0%,100%{transform:translate(0,0) scale(1);opacity:1}50%{transform:translate(40px,-20px) scale(1.1);opacity:0.8}}
        @keyframes heroGlowB{0%,100%{transform:translate(0,0) scale(1);opacity:0.9}50%{transform:translate(-30px,30px) scale(1.08);opacity:1}}
        @keyframes heroPulseDot{0%,100%{box-shadow:0 0 10px #86efac,0 0 0 0 rgba(134,239,172,0.6)}50%{box-shadow:0 0 18px #86efac,0 0 0 10px rgba(134,239,172,0)}}
        @keyframes heroTicker{0%{transform:translateX(0)}100%{transform:translateX(-33.333%)}}
        @keyframes heroStatRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        button:hover{opacity:0.9;} input:focus{outline:none;border-color:#c0392b !important;} a{text-decoration:none;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:#fef9f7;} ::-webkit-scrollbar-thumb{background:#fca5a5;border-radius:2px;}
        .caterer-scroll::-webkit-scrollbar{display:none;}
        .landing-hero button:hover{transform:scale(1.03);}
        @keyframes aayojan-pulse-dot {
          0% { box-shadow: 0 0 0 0 rgba(134,239,172,0.7); }
          70% { box-shadow: 0 0 0 8px rgba(134,239,172,0); }
          100% { box-shadow: 0 0 0 0 rgba(134,239,172,0); }
        }
        .food-grid > div:hover img { transform: scale(1.08); }
        .hamburger-btn{display:flex !important;align-items:center;justify-content:center;transition:border-color .2s,box-shadow .2s;}
        .hamburger-btn:hover{border-color:#E8760A;box-shadow:0 4px 14px rgba(232,118,10,0.18);}
        .header-right{display:none !important;}
        .hb{display:flex;flex-direction:column;justify-content:center;gap:5px;width:22px;height:17px;}
        .hb i{display:block;height:2.5px;width:100%;background:currentColor;border-radius:2px;transition:transform .3s ease,opacity .2s ease;}
        .hb.open i:nth-child(1){transform:translateY(7.5px) rotate(45deg);}
        .hb.open i:nth-child(2){opacity:0;}
        .hb.open i:nth-child(3){transform:translateY(-7.5px) rotate(-45deg);}
        .mobile-menu{transform-origin:top right;animation:menuIn .22s cubic-bezier(.2,.8,.2,1);}
        @keyframes menuIn{from{opacity:0;transform:translateY(-8px) scale(.96);}to{opacity:1;transform:none;}}
        .mobile-menu a, .mobile-menu button{transition:background .15s;}
        .mobile-menu a:hover, .mobile-menu button:hover{background:var(--bg-secondary,#f6efe6);opacity:1;}
        @media(max-width:760px){
          .food-grid > div { grid-column: span 12 !important; height: 200px !important; }
        }
        @media(min-width:761px) and (max-width:1024px){
          .food-grid > div { grid-column: span 6 !important; }
        }
        @media(max-width:700px){
          .feat-grid{grid-template-columns:1fr !important;}
          .browse-strip{grid-template-columns:1fr !important;}
          .landing-hero{min-height:auto !important;}
          .hero-split{grid-template-columns:1fr !important;min-height:auto !important;}
          .hero-split > div:first-child{border-right:none !important;border-bottom:1px solid rgba(243,200,105,0.18) !important;padding:80px 7% 50px !important;}
          .hero-split > div:nth-child(2){padding:60px 7% 80px !important;}
          .hero-medallion{display:none !important;}
          .edit-grid{grid-template-columns:1fr !important;gap:40px !important;}
          .edit-grid>div:last-child{order:-1;}
        }
        @media(max-width:500px){
          .feat-grid{grid-template-columns:1fr !important;}
        }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S={
  root:{minHeight:"100vh",background:"var(--bg-secondary)",fontFamily:"'DM Sans',sans-serif",color:"var(--text-primary)",paddingBottom:60,position:"relative",transition:"background 0.3s ease, color 0.3s ease"},
  bengaliTopBorder:{height:6,background:"linear-gradient(90deg,#c0392b,#e74c3c,#f97316,#e74c3c,#c0392b)",backgroundSize:"200% 100%"},
  bgPattern:{position:"fixed",top:0,left:0,right:0,bottom:0,backgroundImage:"radial-gradient(circle at 20% 20%,rgba(192,57,43,0.03) 0%,transparent 50%),radial-gradient(circle at 80% 80%,rgba(192,57,43,0.03) 0%,transparent 50%)",pointerEvents:"none"},
  header:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderBottom:"1px solid var(--border-light)",position:"sticky",top:0,background:"var(--bg-header)",backdropFilter:"blur(10px)",zIndex:100,boxShadow:"var(--shadow-header)",gap:8,flexWrap:"wrap"},
  page:{maxWidth:820,margin:"0 auto",padding:"24px 14px",overflowX:"hidden"},
  card:{background:"var(--bg-card)",border:"1px solid var(--border-light)",borderRadius:18,padding:"24px 18px",boxShadow:"var(--shadow-card)",transition:"background 0.3s ease, border-color 0.3s ease",overflowX:"hidden",wordBreak:"break-word"},
  cardTitle:{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,marginBottom:6,color:"var(--text-primary)"},
  sectionTitle:{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"var(--text-primary)",marginBottom:20},
  ghostBtn:{background:"var(--bg-card)",border:"1px solid var(--border-default)",color:"var(--text-secondary)",padding:"7px 12px",borderRadius:8,fontSize:12,cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"},
  primaryBtn:{background:"linear-gradient(135deg,#c0392b,#e74c3c)",color:"#fff",border:"none",padding:"12px 24px",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 14px rgba(192,57,43,0.3)",width:"100%",marginTop:8},
  secondaryBtn:{background:"var(--bg-card)",color:"var(--text-secondary)",border:"1px solid var(--border-default)",padding:"11px 20px",borderRadius:10,fontSize:13,cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},
  btnRow:{display:"flex",gap:10,marginTop:18,alignItems:"center"},
  formGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16},
  fieldWrap:{display:"flex",flexDirection:"column",gap:5},
  fieldLabel:{fontSize:12,fontWeight:600,color:"var(--text-primary)",letterSpacing:"0.03em"},
  inp2:{background:"var(--bg-input)",border:"1px solid var(--border-default)",borderRadius:9,padding:"10px 14px",color:"var(--text-primary)",fontSize:13,outline:"none",transition:"border-color 0.2s, background 0.3s ease"},
  tastingBanner:{background:"linear-gradient(135deg,#c0392b,#e74c3c,#b5451b)",borderRadius:18,padding:"24px 28px",display:"flex",gap:20,alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",marginBottom:36,boxShadow:"0 8px 24px rgba(192,57,43,0.25)",position:"relative",overflow:"hidden"},
};

// ─── Payment gateway styles ───────────────────────────────────────────────────
const PG={
  overlay:{position:"fixed",inset:0,zIndex:300,background:"var(--modal-overlay)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16},
  modal:{background:"var(--bg-card)",borderRadius:18,width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,0.2)",overflow:"hidden",border:"1px solid var(--border-light)"},
  header:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:"1px solid var(--border-light)",background:"var(--bg-secondary)"},
  pgLogo:{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,#c0392b,#e74c3c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17},
  amountBanner:{background:"var(--bg-accent-light)",padding:"18px 20px",textAlign:"center",borderBottom:"1px solid var(--border-light)"},
  methodBtn:{display:"flex",alignItems:"center",gap:12,padding:"14px",border:"1px solid var(--border-default)",borderRadius:11,cursor:"pointer",background:"var(--bg-card)",transition:"all 0.15s",width:"100%",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},
  secureRow:{display:"flex",alignItems:"center",gap:6,justifyContent:"center",fontSize:11,color:"var(--text-muted)",marginTop:14,padding:"8px",background:"var(--bg-hover)",borderRadius:8},
  cardPreview:{background:"linear-gradient(135deg,#c0392b,#9b1c1c)",borderRadius:12,padding:"18px 20px",marginBottom:16,boxShadow:"0 4px 12px rgba(192,57,43,0.3)"},
  lbl:{fontSize:12,fontWeight:600,color:"var(--text-primary)",marginBottom:4,display:"block"},
  inp:{width:"100%",padding:"10px 12px",border:"1px solid",borderRadius:9,color:"var(--text-primary)",fontSize:14,outline:"none",background:"var(--bg-input)"},
  ferr:{fontSize:11,color:"#ef4444",marginTop:3},
  payBtn:{width:"100%",padding:"13px",background:"linear-gradient(135deg,#c0392b,#e74c3c)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 14px rgba(192,57,43,0.3)",marginTop:16},
  backLink:{background:"none",border:"none",color:"var(--text-muted)",fontSize:13,cursor:"pointer",marginBottom:14,display:"block",padding:0},
};

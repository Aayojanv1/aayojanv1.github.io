import { useState, useEffect, useRef } from "react";
import { useAuth, getPartners, getAllPartners, addPartner, updatePartner, deletePartner, createOrder, getAllOrders, getUserOrders, savePayment, updateUserPhone, updateUserPreferences, updateUserProfile } from "./useFirebase";
import { matchCaterers, anonymize } from "./matchingPipeline";

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
  {id:"c1",name:"Bhojohori Manna Caterers",ownerName:"Subroto Das",phone:"9830012345",email:"subroto@bhojohori.in",address:"Plot 5A, Action Area I",pincode:"700156",specialty:["Wedding","Party","Religious"],cuisineSpecialties:["Bengali","Multi-cuisine"],serviceTypes:["full"],tags:["Bengali Cuisine","Multi-course"],priceRange:"₹₹₹",logo:"🪷",rating:4.8,turnaround:"2–3 hrs",registeredAt:"2024-01-10",active:true,minGuests:50,maxGuests:800,pricePerPlateMin:400,pricePerPlateMax:1200,yearsInBusiness:12,teamSize:25,totalOrders:145},
  {id:"c2",name:"Kolkata Dawat",ownerName:"Md. Irfan Ali",phone:"9736054321",email:"irfan@kolkatadawat.com",address:"EE-12, Action Area II",pincode:"700157",specialty:["Party","Corporate","Wedding"],cuisineSpecialties:["Mughlai","Kolkata Biryani","North Indian"],serviceTypes:["full","bulk"],tags:["Budget-friendly","Mughlai & Bengali"],priceRange:"₹₹",logo:"🍚",rating:4.6,turnaround:"1–2 hrs",registeredAt:"2024-02-05",active:true,minGuests:20,maxGuests:400,pricePerPlateMin:200,pricePerPlateMax:600,yearsInBusiness:8,teamSize:15,totalOrders:89},
  {id:"c3",name:"Ananda Bhojan Events",ownerName:"Priya Chakraborty",phone:"9674011223",email:"priya@anandabhojan.com",address:"Eco Park Gate 2, Sector IV",pincode:"700160",specialty:["Wedding","Religious"],cuisineSpecialties:["Bengali","Vegetarian Only","Jain"],serviceTypes:["full"],tags:["Luxury","Live counters","Veg specialist"],priceRange:"₹₹₹₹",logo:"🎊",rating:4.9,turnaround:"3–4 hrs",registeredAt:"2024-01-22",active:true,minGuests:80,maxGuests:1200,pricePerPlateMin:600,pricePerPlateMax:1800,yearsInBusiness:18,teamSize:40,totalOrders:210},
  {id:"c4",name:"Thakurbarir Ranna",ownerName:"Goutam Banerjee",phone:"9800167890",email:"goutam@thakurbarir.com",address:"K-7 Rajarhat Main Road",pincode:"700135",specialty:["Wedding","Religious","Party"],cuisineSpecialties:["Bengali","Vegetarian Only"],serviceTypes:["full","bulk"],tags:["Authentic Bengali","Vegetarian"],priceRange:"₹₹",logo:"🏛️",rating:4.7,turnaround:"2–3 hrs",registeredAt:"2024-03-01",active:true,minGuests:30,maxGuests:350,pricePerPlateMin:250,pricePerPlateMax:700,yearsInBusiness:6,teamSize:12,totalOrders:52},
  {id:"c5",name:"Biryani & Beyond",ownerName:"Rajesh Sharma",phone:"9051022334",email:"rajesh@biryanibb.com",address:"Silicon Valley Tower 3",pincode:"700156",specialty:["Party","Corporate"],cuisineSpecialties:["Kolkata Biryani","Mughlai","North Indian"],serviceTypes:["bulk"],tags:["Kolkata Biryani","Non-veg specialist"],priceRange:"₹₹",logo:"🍖",rating:4.5,turnaround:"1–2 hrs",registeredAt:"2024-02-18",active:true,minGuests:1,maxGuests:200,pricePerPlateMin:120,pricePerPlateMax:400,yearsInBusiness:3,teamSize:8,totalOrders:34},
  {id:"c6",name:"Sanmilani Grand Caterers",ownerName:"Debabrata Roy",phone:"9339044556",email:"deb@sanmilani.com",address:"New Town Connector, Block D",pincode:"700157",specialty:["Wedding","Party","Corporate","Religious"],cuisineSpecialties:["Bengali","North Indian","Continental","Multi-cuisine"],serviceTypes:["full","bulk"],tags:["Premium","Full-service","Pan-Bengali"],priceRange:"₹₹₹",logo:"👑",rating:4.8,turnaround:"2–4 hrs",registeredAt:"2024-01-30",active:true,minGuests:40,maxGuests:1000,pricePerPlateMin:350,pricePerPlateMax:1500,yearsInBusiness:15,teamSize:35,totalOrders:178},
  {id:"c7",name:"Roshni's Kitchen",ownerName:"Roshni Ghosh",phone:"9123045567",email:"roshni@roshniskitchen.in",address:"Plot 12, Action Area III",pincode:"700161",specialty:["Party","Corporate"],cuisineSpecialties:["Bengali","Continental","Street Food"],serviceTypes:["bulk"],tags:["Home-style","Small batches","Fresh"],priceRange:"₹",logo:"🏡",rating:4.3,turnaround:"1–2 hrs",registeredAt:"2026-04-15",active:true,minGuests:1,maxGuests:100,pricePerPlateMin:120,pricePerPlateMax:350,yearsInBusiness:1,teamSize:4,totalOrders:3},
  {id:"c8",name:"Spice Route Caterers",ownerName:"Anirban Sen",phone:"9876012345",email:"anirban@spiceroute.com",address:"Salt Lake Sector V, BN Block",pincode:"700059",specialty:["Corporate","Party","Wedding"],cuisineSpecialties:["North Indian","Punjabi","Rajasthani","Multi-cuisine"],serviceTypes:["full","bulk"],tags:["Corporate specialist","Thali setup","Punjabi"],priceRange:"₹₹₹",logo:"🌶️",rating:4.6,turnaround:"2–3 hrs",registeredAt:"2025-11-01",active:true,minGuests:25,maxGuests:500,pricePerPlateMin:300,pricePerPlateMax:900,yearsInBusiness:5,teamSize:18,totalOrders:15},
  {id:"c9",name:"Maa Annapurna Foods",ownerName:"Sumitra Devi",phone:"9830178901",email:"sumitra@annapurna.com",address:"Baguiati Main Road",pincode:"700136",specialty:["Religious","Wedding","Party"],cuisineSpecialties:["Bengali","Vegetarian Only"],serviceTypes:["full","bulk"],tags:["Temple catering","Pure veg","Budget"],priceRange:"₹",logo:"🪔",rating:4.4,turnaround:"2–3 hrs",registeredAt:"2026-03-20",active:true,minGuests:20,maxGuests:300,pricePerPlateMin:150,pricePerPlateMax:450,yearsInBusiness:2,teamSize:6,totalOrders:8},
  {id:"c10",name:"Flames & Flavors",ownerName:"Arjun Kapoor",phone:"9051098765",email:"arjun@flamesflavors.com",address:"EM Bypass, Near Ruby Hospital",pincode:"700105",specialty:["Party","Corporate","Wedding"],cuisineSpecialties:["Continental","Chinese","Multi-cuisine","North Indian"],serviceTypes:["full","bulk"],tags:["Modern cuisine","Live BBQ","Fusion"],priceRange:"₹₹₹",logo:"🔥",rating:4.7,turnaround:"2–4 hrs",registeredAt:"2025-06-10",active:true,minGuests:30,maxGuests:600,pricePerPlateMin:350,pricePerPlateMax:1100,yearsInBusiness:7,teamSize:22,totalOrders:67},
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
  const [msgs,setMsgs]=useState([{role:"assistant",text:"নমস্কার! 🙏 I'm **Aayojan AI** — your catering assistant for Newtown, Kolkata!\n\nTell me about your event: guests, budget, cuisine preferences, and I'll create your custom catering order.\n\nTry: *\"I need catering for 150 guests at a wedding, budget ₹600 per plate, Action Area I\"*"}]);
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

  const SYSTEM=`You are Aayojan AI, a catering assistant for Newtown, Kolkata. You ONLY help with catering and food ordering. STRICT RULES:
1) If the user asks about anything NOT related to food, catering, events, menus, or party planning — politely redirect: "I'm your catering assistant! Let's plan your perfect event 🍽️ Tell me about your guests, cuisine, and budget."
2) If the user uses profanity or abusive language — respond: "Let's keep things friendly! 😊 I'm here to help plan amazing food for your event. What kind of catering do you need?"
3) Do NOT engage with off-topic conversations (politics, tech, jokes, personal questions, etc.) — always steer back to catering.
4) Keep replies to 2-3 sentences. Be warm, use vivid appetizing descriptions ("aromatic slow-cooked", "melt-in-your-mouth", "crispy golden", "creamy rich").
CRITICAL MENU FORMAT: When suggesting or listing menu items, you MUST format EACH item on its own line with price like this:
**🥘 Starters:**
- Fish Fry — ₹90/plate
- Chicken Cutlet — ₹75/plate
- Paneer Tikka — ₹85/plate

**🍛 Main Course:**
- Kosha Mangsho — ₹180/plate
- Chicken Biryani — ₹150/plate
- Chingri Malai Curry — ₹220/plate

**🍮 Desserts:**
- Mishti Doi — ₹50/plate
- Rasgolla — ₹40/plate

NEVER list items comma-separated on one line. ALWAYS one item per line with "— ₹price/plate". This is mandatory for UI rendering.
5) Collect: service type (full catering 30+ guests with staff/cutlery, OR bulk delivery any quantity packed), event type, guest count, per-plate budget ₹350-1800 full / ₹120-600 bulk, menu items, pincode (700156-Action Area I, 700157-Action Area II, 700135-Rajarhat, 700161-Action Area III, 700136-Baguiati, 700059-Salt Lake V, 700091-Salt Lake, 700105-EM Bypass, 700107-Gariahat, 700160-Eco Park).
6) COST ESTIMATION (based on 2025 Kolkata market rates — Arsalan, Aminia, local caterers): When user asks for cost/estimate or discusses menu, provide realistic estimates:
   POPULAR DISH RATES (bulk delivery per plate, Kolkata 2025):
   - Chicken Biryani: ₹120-180/plate, Mutton Biryani: ₹180-280/plate
   - Chicken Chap/Chaap: ₹80-120/plate, Mutton Chap: ₹120-160/plate
   - Biryani + Chap Combo: ₹180-280/plate (chicken), ₹250-380/plate (mutton)
   - Sorshe Ilish: ₹200-300/plate, Chingri Malai Curry: ₹180-250/plate
   - Kosha Mangsho: ₹150-220/plate, Mutton Curry: ₹140-200/plate
   - Chicken Cutlet/Starter: ₹60-90/plate, Fish Fry: ₹80-120/plate
   - Paneer/Veg Main: ₹70-110/plate, Dal+Rice combo: ₹60-90/plate
   - Luchi-Alur Dom: ₹50-80/plate, Pulao: ₹60-90/plate
   - Mishti Doi/Dessert: ₹40-70/plate, Rasgolla: ₹30-50/plate
   FULL CATERING (with staff, cutlery, setup, buffet service):
   - Basic Veg Package (2 starters + 4 mains + rice + 1 dessert): ₹400-600/plate
   - Standard Non-Veg Package (3 starters + 5 mains + rice + breads + 2 desserts): ₹600-900/plate
   - Premium Package (4+ starters + 6 mains + live counters + 3 desserts + mocktails): ₹1000-1600/plate
   - Royal/Luxury (lavish spread, multiple cuisines, live counters): ₹1500-3000/plate
   Add 15-25% for service staff, cutlery, setup & cleanup on top of food cost.
   BULK DELIVERY (packed, no service staff): Use the dish rates above directly. No service surcharge.
   ESTIMATION FORMULA: Sum(per_plate_cost_of_each_item) × guests. For full catering add 20% service.
   Volume discounts: 200+ guests get 5-10% off, 500+ get 10-15% off.
   IMPORTANT: Do NOT underestimate. Biryani+Chap for 50 guests should be ₹9,000-₹14,000 NOT ₹4,500.
   Always say: "💡 This is a market-based estimate. Actual quotes from our caterer network may be 10-20% different based on their specialization and availability."
7) When you have ALL info output: ###ORDER_JSON###{"serviceType":"full","eventType":"wedding","guestCount":150,"perPlateBudget":600,"menuItems":["Sorshe Ilish","Mishti Doi"],"pincode":"700156","summary":"..."}###END_JSON###`;

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
        {["🎂 Birthday party, 50 guests","💍 Wedding, 200 guests","📦 Bulk delivery, 30 portions","🪔 Durga Puja feast, 100 people"].map(p=><button key={p} onClick={()=>{setInput(p);setTimeout(()=>inputRef.current?.focus(),50);}} style={{fontSize:11,padding:"5px 10px",borderRadius:12,background:"var(--bg-accent-light)",border:"1px solid var(--border-accent)",color:"var(--text-accent)",cursor:"pointer",whiteSpace:"nowrap"}}>{p}</button>)}
      </div>}
      <div style={{display:"flex",gap:8,padding:"10px 12px",borderTop:"1px solid var(--border-default)",background:"var(--bg-card)",flexDirection:"column"}}>
        <div style={{display:"flex",gap:8}}>
          <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value.slice(0,MAX_MSG_LENGTH))} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()} placeholder={blocked?"Session paused — refresh to start over":"Describe your event, guests, budget..."} disabled={blocked} style={{flex:1,background:"var(--bg-hover)",border:"1px solid var(--border-default)",borderRadius:12,padding:"10px 14px",color:"var(--text-primary)",fontSize:13,outline:"none",opacity:blocked?0.5:1}}/>
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
  const [animIn,setAnimIn]=useState(true);

  // Dark mode
  const [darkMode,setDarkMode]=useState(()=>{
    const saved=localStorage.getItem("aayojan-dark-mode");
    if(saved!==null) return saved==="true";
    return window.matchMedia?.("(prefers-color-scheme:dark)").matches||false;
  });
  useEffect(()=>{
    document.documentElement.setAttribute("data-theme",darkMode?"dark":"light");
    localStorage.setItem("aayojan-dark-mode",darkMode);
  },[darkMode]);

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
    try{ await loginWithGoogle(); setShowLogin(false); }
    catch(e){ setLoginError(e.message); }
    finally{ setLoginLoading(false); }
  };
  const handleEmailAuth=async()=>{
    setLoginError("");
    if(!loginEmail||!loginPassword){setLoginError("Email and password required.");return;}
    if(loginMode==="signup"&&!loginName){setLoginError("Name is required.");return;}
    setLoginLoading(true);
    try{
      if(loginMode==="signup") await signupWithEmail(loginEmail,loginPassword,loginName);
      else await loginWithEmail(loginEmail,loginPassword);
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
    },1800);
  };

  // ── Payment handlers ──────────────────────────────────────────────────────
  const handleUnlockPhone=(caterer)=>{
    if(!user){setShowLogin(true);return;}
    if(unlockedPhones[caterer.id]){return;}
    setPaymentModal({amount:PHONE_UNLOCK_FEE,purpose:`Unlock ${caterer.name}'s contact number`,catererId:caterer.id,type:"phone_unlock",catererName:caterer.name,
      onSuccess:async()=>{
        await savePayment({customerId:user.uid,catererId:caterer.id,catererName:caterer.name,type:"phone_unlock",amount:PHONE_UNLOCK_FEE,status:"success",paidAt:new Date().toISOString()});
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
        setTastingBooked(prev=>({...prev,[caterer.id]:true}));
        setPaymentModal(null);
      }
    });
  };

  // ── Order ─────────────────────────────────────────────────────────────────
  const validateAddress=()=>{const e={};if(!deliveryAddress.flat.trim())e.flat="Required";if(!deliveryAddress.building.trim())e.building="Required";if(!deliveryAddress.street.trim())e.street="Required";if(!deliveryAddress.pincode.trim()||deliveryAddress.pincode.length!==6)e.pincode="Valid 6-digit pincode required";setAddressErrors(e);return Object.keys(e).length===0;};
  const placeOrder=async()=>{if(!validateAddress())return;const order={quotationRequestId:quotationRequest?.id,customerId:user?.uid,customerEmail:user?.email,customerPhone:user?.phone||"",catererId:selectedQuote.id,catererName:selectedQuote._realName||selectedQuote.name,eventType,serviceType,guestCount,perPlateBudget,perPlateActual:selectedQuote.perPlateActual,menuItems:selectedItems,deliveryAddress:`${deliveryAddress.flat}, ${deliveryAddress.building}, ${deliveryAddress.street}${deliveryAddress.landmark?", "+deliveryAddress.landmark:""}, ${deliveryAddress.city} - ${deliveryAddress.pincode}`,deliveryPincode:deliveryAddress.pincode,distanceKm:selectedQuote.distanceKm,basePrice:selectedQuote.basePrice,travelSurcharge:selectedQuote.travelSurcharge,totalPrice:selectedQuote.totalPrice,quoteCode:selectedQuote.quoteCode,matchScore:selectedQuote._matchPercent,status:"Confirmed",placedAt:new Date().toISOString()};const orderId=await createOrder(order);setOrderPlaced({id:orderId,...order});setStep(6);};

  // ── Registration ──────────────────────────────────────────────────────────
  const validateReg=()=>{const e={};if(!regForm.name.trim())e.name="Required";if(!regForm.ownerName.trim())e.ownerName="Required";if(!/^\d{10}$/.test(regForm.phone))e.phone="Valid 10-digit number";if(!regForm.email.includes("@"))e.email="Valid email required";if(!regForm.address.trim())e.address="Required";if(!PINCODE_COORDS[regForm.pincode.trim()])e.pincode="Valid Kolkata pincode";if(regForm.specialty.length===0)e.specialty="Select at least one";if(regForm.cuisineSpecialties.length===0)e.cuisineSpecialties="Select at least one";if(regForm.serviceTypes.length===0)e.serviceTypes="Select at least one";if(regForm.pricePerPlateMin>=regForm.pricePerPlateMax)e.pricing="Min must be less than max";setRegErrors(e);return Object.keys(e).length===0;};
  const submitReg=async()=>{if(!validateReg())return;const logos=["🍽️","🥘","🫕","🥗","🍛","🥞","🎂"];await addPartner({...regForm,pincode:regForm.pincode.trim(),logo:logos[Math.floor(Math.random()*logos.length)],tags:regForm.cuisineSpecialties.slice(0,3),turnaround:regForm.turnaround,deliveryPincodes:regForm.deliveryPincodes.length>0?regForm.deliveryPincodes:Object.keys(PINCODE_COORDS)});setRegSuccess(true);setRegStep(0);getPartners().then(p=>{if(p.length>0)setFirestoreCaterers(p);});};

  const copyCode=(code)=>{navigator.clipboard?.writeText(code);setCopiedCode(code);setTimeout(()=>setCopiedCode(null),2000);};
  const toggleItem=(item)=>setSelectedItems(prev=>prev.includes(item)?prev.filter(i=>i!==item):[...prev,item]);
  const addCustomItem=()=>{if(customItem.trim()&&!selectedItems.includes(customItem.trim())){setSelectedItems(prev=>[...prev,customItem.trim()]);setCustomItem("");}};
  const resetApp=()=>{setStep(0);setServiceType(null);setQuotes([]);setSelectedItems([]);setEventType(null);setEventDate("");setMealTime("");setDietaryPref("any");setGuestCount(100);setPerPlateBudget(500);setCustomerPincode("");setCustomerCoords(null);setSelectedQuote(null);setOrderPlaced(null);setQuotationRequest(null);setWhatsappSent([]);setDeliveryAddress({flat:"",building:"",street:"",landmark:"",pincode:"",city:"Kolkata",state:"West Bengal"});};

  if(authLoading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"var(--bg-primary)"}}><div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:12}}>🍛</div><div style={{color:"var(--text-secondary)"}}>Loading...</div></div></div>;

  return(
    <div style={S.root}>
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
          <button className="theme-toggle" onClick={()=>setDarkMode(!darkMode)} title={darkMode?"Switch to light mode":"Switch to dark mode"}>{darkMode?"☀️":"🌙"}</button>
          {view!=="landing"&&<button onClick={()=>navigate("landing")} style={S.ghostBtn}>← Home</button>}
          <button onClick={()=>navigate("chat")} style={{...S.ghostBtn,borderColor:"#fca5a5",color:"#c0392b",background:"#fff5f5"}}>🤖 AI Chat</button>
          {user?.isAdmin&&<button onClick={()=>{loadAdminData();navigate("admin");}} style={{...S.ghostBtn,borderColor:"#bbf7d0",color:"#16a34a",background:"#f0fdf4"}}>👑 Admin</button>}
          {user?<div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={openProfile} style={{display:"flex",alignItems:"center",gap:5,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#16a34a",cursor:"pointer"}}>
              {user.photoURL?<img src={user.photoURL} alt="" style={{width:20,height:20,borderRadius:"50%"}}/>:<span>👤</span>}
              {user.displayName||user.email}
            </button>
            <button onClick={logout} style={{background:"none",border:"1px solid #fca5a5",borderRadius:8,padding:"6px 10px",fontSize:11,color:"#c0392b",cursor:"pointer"}}>Logout</button>
          </div>:<button onClick={()=>setShowLogin(true)} style={{...S.primaryBtn,padding:"8px 16px",width:"auto",marginTop:0}}>Login</button>}
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
            {[["🍽️",allCaterers.length+"+","Caterers"],["📍","10+","Pincodes"],["⭐","4.7","Avg Rating"],["🎉","500+","Events"]].map(([icon,val,lbl])=>(
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
              {allCaterers.slice(0,3).map(c=>(
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
              <AayojanChatbot user={user} allCaterers={allCaterers} onOrderCreated={order=>{setChatOrderConfirmed(order);}} onLoginRequired={()=>setShowLogin(true)} onStartOrderFlow={(caterer)=>{setServiceType(caterer?.serviceTypes?.[0]||"full");setCustomerPincode("");setStep(0);navigate("app");}}/>
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
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"var(--text-primary)",marginTop:10,marginBottom:6}}>Register Your Catering Business</h2>
                <p style={{fontSize:13,color:"var(--text-secondary)"}}>Join Newtown's fastest-growing caterer network</p>
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
                      <label style={S.fieldLabel}>FSSAI License No. (optional but boosts ranking)</label>
                      <input style={S.inp2} value={regForm.fssaiLicense} onChange={e=>setRegForm({...regForm,fssaiLicense:e.target.value})} placeholder="14-digit FSSAI number"/>
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
                <div><div style={{fontWeight:700,color:"#1f2937",marginBottom:2}}>Quotation in 48 Hours</div><div style={{fontSize:12,color:"#6b7280",lineHeight:1.5}}>WhatsApp sent to <strong style={{color:accent}}>up to 5 caterers</strong> near you with budget <strong style={{color:accent}}>₹{perPlateBudget}/{serviceType==="full"?"plate":"portion"}</strong>.</div></div>
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
                      <label style={S.fieldLabel}>FSSAI License No. (optional but boosts ranking)</label>
                      <input style={S.inp2} value={regForm.fssaiLicense} onChange={e=>setRegForm({...regForm,fssaiLicense:e.target.value})} placeholder="14-digit FSSAI number"/>
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
              <p>For privacy concerns, email us at: <strong>privacy@aayojan.in</strong></p>
            </div>
          </div>
        </div>
      )}

      {view==="terms"&&(
        <div style={{...S.page,...anim}}>
          <button onClick={()=>navigate("landing")} style={{...S.secondaryBtn,marginBottom:20}}>← Back to Home</button>
          <div style={S.card}>
            <h1 style={{...S.cardTitle,fontSize:22,marginBottom:16}}>Terms of Service</h1>
            <p style={{fontSize:12,color:"#9ca3af",marginBottom:16}}>Last updated: 29 May 2025</p>
            <div style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.8}}>
              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>1. About Aayojan</h3>
              <p>Aayojan is a technology platform that connects customers with independent caterers in the Newtown/Rajarhat/Salt Lake area of Kolkata. We are a marketplace — we do NOT prepare or serve food ourselves.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>2. User Accounts</h3>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li>You must provide accurate information during registration</li>
                <li>You are responsible for maintaining the security of your account</li>
                <li>One account per person; no shared or bot accounts</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>3. Orders & Payments</h3>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li>Prices quoted by caterers are estimates and may vary based on final requirements</li>
                <li>A platform fee (₹99–₹299) applies per booking</li>
                <li>Payment is made directly to the caterer or via our escrow system (when available)</li>
                <li>Aayojan is not responsible for food quality — that liability rests with the caterer</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>4. Caterer Listings</h3>
              <p>We vet our partner caterers but do not guarantee their services. Ratings, reviews, and match scores are algorithmically generated and meant as guidance, not guarantees.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>5. Cancellation</h3>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li>Free cancellation up to 72 hours before event</li>
                <li>50% charge for cancellation 24–72 hours before event</li>
                <li>No refund for cancellation less than 24 hours before event</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>6. Prohibited Use</h3>
              <p>You may not use the platform to harass caterers, submit false orders, scrape data, or circumvent the platform to contact caterers directly for repeat orders.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>7. Limitation of Liability</h3>
              <p>Aayojan's liability is limited to the platform fee charged. We are not liable for food quality, delivery delays, or any damages caused by the caterer's services.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>8. Governing Law</h3>
              <p>These terms are governed by the laws of India. Disputes shall be subject to the jurisdiction of courts in Kolkata, West Bengal.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>9. Contact</h3>
              <p>For questions about these terms: <strong>legal@aayojan.in</strong></p>
            </div>
          </div>
        </div>
      )}

      {view==="refund"&&(
        <div style={{...S.page,...anim}}>
          <button onClick={()=>navigate("landing")} style={{...S.secondaryBtn,marginBottom:20}}>← Back to Home</button>
          <div style={S.card}>
            <h1 style={{...S.cardTitle,fontSize:22,marginBottom:16}}>Refund & Cancellation Policy</h1>
            <p style={{fontSize:12,color:"#9ca3af",marginBottom:16}}>Last updated: 29 May 2025</p>
            <div style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.8}}>
              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>Platform Fee Refund</h3>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li><strong>No caterer responded:</strong> Full refund of platform fee</li>
                <li><strong>You cancel before accepting a quote:</strong> Full refund</li>
                <li><strong>You cancel after accepting but 72+ hours before event:</strong> 80% refund of platform fee</li>
                <li><strong>You cancel 24–72 hours before event:</strong> 50% refund</li>
                <li><strong>Less than 24 hours:</strong> No refund</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>Caterer Payment Refunds</h3>
              <p>Refunds for payments made directly to caterers must be resolved with the caterer. Aayojan will assist in dispute resolution but cannot guarantee refunds from third-party caterers.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>Phone Unlock Fee (₹49)</h3>
              <p>Non-refundable once the caterer's phone number has been revealed.</p>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>Food Tasting Fee (₹199)</h3>
              <ul style={{paddingLeft:20,margin:"8px 0"}}>
                <li>Refundable if caterer cancels the tasting session</li>
                <li>Non-refundable if you don't show up for a confirmed session</li>
                <li>Adjusted against final order if you book the caterer</li>
              </ul>

              <h3 style={{color:"var(--text-primary)",margin:"14px 0 8px"}}>How to Request a Refund</h3>
              <p>Email <strong>support@aayojan.in</strong> with your order ID. Refunds are processed within 5–7 business days to the original payment method.</p>
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
        </div>
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

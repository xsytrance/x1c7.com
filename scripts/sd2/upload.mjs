#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";
const MAIN="/home/xsyprime/Hermes/x1c7.com", SLUG="summer-drip-v2";
const EDGE="https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev", WEBP="scripts/sd2/webp";
// scene-smile is GONE at the Sovereign's word ("I really don't like this
// picture and you're reusing it a lot") — deleted, not re-rolled. Thirteen new
// environmental plates take the set from 18 to 30 so the rotation has somewhere
// to go. `boards` from that batch is dropped: it rendered as a door, not a deck.
const PICKS={heat:"heat-0",deck:"deck-0",sundress:"sundress-0",daylight:"daylight-0",
 midnight:"midnight-0",flame:"flame-0",steps:"steps-0",
 streetlamp:"streetlamp-0",perfume:"perfume-0",eyes:"eyes-0",spot:"spot-0",
 queen:"queen-1",dancefloor:"dancefloor-0",lens:"lens-0",crowd:"crowd-0",
 gold:"gold-0",drip:"drip-0",
 pool:"pool-0",marina:"marina-0",convertible:"convertible-0",champagne:"champagne-0",
 dunes:"dunes-0",djbooth:"djbooth-0",firepit:"firepit-0",curtain:"curtain-0",
 waves:"waves-0",walkaway:"walkaway-0",sunhat:"sunhat-0",table:"table-0",
 profile:"profile-0"};

const loadEnv=(f)=>Object.fromEntries((existsSync(f)?readFileSync(f,"utf8"):"").split(/\r?\n/)
 .map(l=>l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
 .map(m=>[m[1],m[2].replace(/^["']|["']$/g,"")]));
const E={...loadEnv(join(MAIN,".env")),...loadEnv(join(MAIN,".env.local"))};
const aws=new AwsClient({accessKeyId:E.ACCESS_KEY_ID,secretAccessKey:E.SECRET_ACCESS_KEY,region:"auto",service:"s3"});
const base=`${E.ENDPOINT.replace(/\/$/,"")}/${E.BUCKET||"x1c7-music"}`;
mkdirSync(WEBP,{recursive:true});
let ok=0,bad=0;
for(const [name,file] of Object.entries(PICKS)){
  const png=`scripts/sd2/plates/${file}.png`;
  if(!existsSync(png)){console.log(`✗ ${name} missing ${file}`);bad++;continue;}
  const webp=join(WEBP,`${name}.webp`);
  execFileSync("ffmpeg",["-y","-v","error","-i",png,"-quality","90",webp]);
  const body=readFileSync(webp), key=`planets/${SLUG}/scene-${name}.webp`;
  const put=await aws.fetch(`${base}/${key}`,{method:"PUT",body,headers:{"content-type":"image/webp"}});
  if(!put.ok){console.log(`✗ ${name} PUT ${put.status}`);bad++;continue;}
  const got=await fetch(`${EDGE}/${key}?cb=${Date.now()}`,{cache:"no-store"});
  if(!got.ok||Number(got.headers.get("content-length"))!==body.length){console.log(`✗ ${name} edge`);bad++;continue;}
  ok++;
}
console.log(`${ok} uploaded, ${bad} failed`);
// pool for the hook words so a repeat never freezes the frame (§3e)
const P=(n)=>`/planets/${SLUG}/scene-${n}.webp`;
const gallery={slug:SLUG,art:{
  // "every" fires nine times in the intro alone, so it gets the deepest pool.
  every:[P("crowd"),P("table"),P("pool"),P("marina"),P("dunes"),P("firepit"),
         P("curtain"),P("walkaway"),P("champagne"),P("boards")].filter(u=>!u.includes("boards")),
  drip:[P("drip"),P("champagne"),P("gold"),P("perfume"),P("sunhat")],
  mean:[P("sundress"),P("walkaway"),P("profile"),P("convertible"),P("dancefloor")],
  all:[P("crowd"),P("table"),P("lens"),P("firepit")],
  summer:[P("daylight"),P("pool"),P("marina"),P("waves")],
  hips:[P("sundress"),P("walkaway"),P("dancefloor")],
  every_little:[P("steps")],
}};

const gk=`planets/${SLUG}/gallery.json`, gb=Buffer.from(JSON.stringify(gallery,null,2));
const gp=await aws.fetch(`${base}/${gk}`,{method:"PUT",body:gb,headers:{"content-type":"application/json"}});
console.log("gallery:", gp.ok?"ok":`FAILED ${gp.status}`);
process.exit(bad?1:0);

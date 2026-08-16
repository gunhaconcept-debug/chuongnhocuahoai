import { spawnSync } from "node:child_process";
import fs from "node:fs";

const stories=JSON.parse(fs.readFileSync("data/stories.json","utf8"));
for(const s of stories){
  console.log("Refreshing",s.title);
  const r=spawnSync(process.execPath,["scripts/add-story.mjs"],{
    stdio:"inherit",
    env:{...process.env,MONKEYD_URL:s.monkeyd,AUDIO_URL:s.audio||"",SHOPEE_URL:s.shopee||""}
  });
  if(r.status!==0) console.error("Không cập nhật được:",s.monkeyd);
}
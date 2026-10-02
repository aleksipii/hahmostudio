/* Classic worker: MediaPipe's wasm loader uses importScripts. Camera pixels stay here. */
self.exports={};
importScripts(new URL('./vision/vision_bundle.js',self.location.href).href);
const {FaceLandmarker,FilesetResolver}=self.exports;
let model;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){const root=new URL('./vision',self.location.href).href;model=await FaceLandmarker.createFromOptions(await FilesetResolver.forVisionTasks(root),{baseOptions:{modelAssetPath:root+'/face_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true});self.postMessage({type:'ready'});}
  if(data.type==='frame'){try{const result=model.detectForVideo(data.bitmap,data.timestamp);self.postMessage({type:'result',landmarks:result.faceLandmarks[0]??[],shapes:result.faceBlendshapes[0]?.categories??[]});}finally{data.bitmap.close();}}
 }catch(e){self.postMessage({type:'error',message:String(e?.message??e)});}
};

const z=Object.freeze({w:612,h:792,margin:36,header:30,footer:96,gap:18,label:14}),M=72/2.54;function H(i,n){const l=i.width*100*n/175,a=l/(i.aspect||1);return{wCm:l,hCm:a,w:l*M,h:a*M}}function v(i,n=z){const l=n.margin,a=n.w-n.margin,d=n.h-n.margin-n.header,C=n.margin+n.footer,u=a-l,c=d-C-n.label,h=[];let $=null,p=l,w=d,x=0;const j=()=>{$={items:[]},h.push($),p=l,w=d,x=0};for(const o of i){if(!(o.w>0&&o.h>0))continue;if(o.w<=u&&o.h<=c){$||j();const e=Math.min(u,Math.max(o.w,o.labelW||0));p+e>a+1e-6&&(w-=x+n.label+n.gap,p=l,x=0),w-n.label-o.h<C-1e-6&&j(),$.items.push({id:o.id,x:p,y:w-n.label-o.h,w:o.w,h:o.h,labelY:w-n.label+4}),p+=e+n.gap,x=Math.max(x,o.h);continue}const b=Math.ceil(o.w/u),F=Math.ceil(o.h/c),E=o.w/b,S=o.h/F;for(let e=0;e<F;e++)for(let s=0;s<b;s++){j();const f=l,R=d-n.label-S;$.items.push({id:o.id,x:f-s*E,y:R-(F-1-e)*S,w:o.w,h:o.h,clip:{x:f,y:R,w:E,h:S},part:{row:e+1,col:s+1,rows:F,cols:b},labelY:d-n.label+4})}$=null}return h}const G=i=>String(i).replace(/[^\x20-\x7e]/g,"?").replace(/[\\()]/g,n=>"\\"+n),r=i=>(Math.round(i*100)/100).toString();function W(i){const n=new Uint8Array(i.length);for(let l=0;l<i.length;l++)n[l]=i.charCodeAt(l)&255;return n}function I(i,n,{title:l="Ink Atlas",page:a=z}={}){if(!i.length)throw new Error("Nothing to print");const d=[],C=[];let u=0;const c=e=>{const s=typeof e=="string"?W(e):e;d.push(s),u+=s.length},h=[],$=()=>(h.push(null),h.length),p=$(),w=$(),x=$(),j=$(),o={};for(const e of new Set(i.flatMap(s=>s.items.map(f=>f.id)))){const s=n[e];if(!s||!s.jpeg)throw new Error("Missing artwork");o[e]=$()}const b=[];i.forEach((e,s)=>{const f=$(),R=$();b.push(f);const D=[...new Set(e.items.map(t=>t.id))].map(t=>`/Im${o[t]} ${o[t]} 0 R`).join(" ");let m="";const P=(t,A,T,B,O)=>{m+=`BT /${O?"F2":"F1"} ${T} Tf ${r(t)} ${r(A)} Td (${G(B)}) Tj ET
`};P(a.margin,a.h-a.margin-14,13,l,!0),P(a.w-a.margin-70,a.h-a.margin-14,9,`Page ${s+1} of ${i.length}`);for(const t of e.items){const A=n[t.id];t.clip?m+=`q ${r(t.clip.x)} ${r(t.clip.y)} ${r(t.clip.w)} ${r(t.clip.h)} re W n
`:m+=`q
`,m+=`${r(t.w)} 0 0 ${r(t.h)} ${r(t.x)} ${r(t.y)} cm /Im${o[t.id]} Do Q
`;const T=t.clip||t;m+=`q 0.6 G 0.5 w [3 3] 0 d ${r(T.x)} ${r(T.y)} ${r(T.w)} ${r(T.h)} re S Q
`;const B=T.x,O=t.part?`  part ${(t.part.row-1)*t.part.cols+t.part.col} of ${t.part.rows*t.part.cols} (row ${t.part.row}, column ${t.part.col}): line up the edges`:"";P(B,t.labelY,9,`${A.name}  ${A.note||""}${O}`,!!t.part)}const g=a.margin,y=a.margin+22;m+=`q 0 G 1 w ${r(g)} ${r(y)} 72 72 re S Q
`,m+=`q 0 G 1 w ${r(g+96)} ${r(y)} m ${r(g+96+5*M)} ${r(y)} l S`;for(let t=0;t<=5;t++)m+=` ${r(g+96+t*M)} ${r(y)} m ${r(g+96+t*M)} ${r(y+(t%5?6:12))} l S`;m+=` Q
`,P(g+22,y+31,9,"1 inch"),P(g+96,y+18,9,"5 cm"),P(g,a.margin+6,9,"Print at 100% (Actual size, no Fit to page). The square should measure exactly 1 inch.");const q=W(m);h[R-1]=()=>{c(`<< /Length ${q.length} >>
stream
`),c(q),c(`
endstream`)},h[f-1]=()=>c(`<< /Type /Page /Parent ${w} 0 R /MediaBox [0 0 ${a.w} ${a.h}] /Resources << /Font << /F1 ${x} 0 R /F2 ${j} 0 R >> /XObject << ${D} >> >> /Contents ${R} 0 R >>`)}),h[p-1]=()=>c(`<< /Type /Catalog /Pages ${w} 0 R >>`),h[w-1]=()=>c(`<< /Type /Pages /Kids [${b.map(e=>e+" 0 R").join(" ")}] /Count ${b.length} >>`),h[x-1]=()=>c("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),h[j-1]=()=>c("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");for(const[e,s]of Object.entries(o)){const f=n[e].jpeg;h[s-1]=()=>{c(`<< /Type /XObject /Subtype /Image /Width ${f.width} /Height ${f.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${f.data.length} >>
stream
`),c(f.data),c(`
endstream`)}}c(`%PDF-1.4
%âãÏÓ
`),h.forEach((e,s)=>{C[s]=u,c(`${s+1} 0 obj
`),e(),c(`
endobj
`)});const F=u;c(`xref
0 ${h.length+1}
0000000000 65535 f 
`);for(const e of C)c(String(e).padStart(10,"0")+` 00000 n 
`);c(`trailer
<< /Size ${h.length+1} /Root ${p} 0 R >>
startxref
${F}
%%EOF
`);const E=new Uint8Array(u);let S=0;for(const e of d)E.set(e,S),S+=e.length;return E}function N(i){const n=l=>(l/2.54).toFixed(1);return`${n(i.wCm)} x ${n(i.hCm)} in (${i.wCm.toFixed(1)} x ${i.hCm.toFixed(1)} cm)`}export{z as PAGE,I as buildPrintPdf,v as layoutPrint,H as pieceSize,N as sizeNote};

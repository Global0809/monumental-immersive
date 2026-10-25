function a(t=60){const r=1e3/Math.max(1,t);let e=-1/0;return{ready(n){return(!Number.isFinite(e)||n-e>r*4)&&(e=n),n+.75<e?!1:(e+=r,!0)},reset(){e=-1/0}}}export{a as c};

// Column major matrix functions
const {sin,cos,sqrt,tan,PI}=Math,
       pi=PI;

export function xRot(a){
  const s=sin(a);
  const c=cos(a);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}

export function yRot(a){
  const s=sin(a);
  const c=cos(a);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

export function zRot(a){
  const s=sin(a);
  const c=cos(a);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function vRot([x,y,z],theta){
  x??=0; y??=0; z??=0;
  const length = sqrt(x*x + y*y + z*z);
  if (length==0) {
    if (theta===undefined){ 
       return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    }
    else {
       throw new Error("Rotation axis vector cannot be zero if a rotation angle is specified!");
    }
  }
  if (theta===undefined) theta=length;
  const c=cos(theta);
  const c1=1-c;
  const s=sin(theta);
  x/=length;
  y/=length;
  z/=length;
  return[c + c1*x**2, c1*x*y + s*z, c1*x*z - s*y, 0, c1*x*y - s*z, c + c1*y**2, c1*y*z + s*x, 0, c1*x*z + s*y, c1*y*z - s*x, c + c1*z**2, 0, 0, 0, 0, 1];
}

export function tLat([tx,ty,tz]){
  tx??=0; ty??=0; tz??=0;
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1];
}

export function scal([sx, sy, sz]) {
  sx??=1; sy??=1; sz??=1;
  return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
}

export function T(A){
  return new Float32Array([A[0], A[4], A[8], A[12], A[1], A[5], A[9], A[13], A[2], A[6], A[10], A[14], A[3], A[7], A[11], A[15]]);
}

export function mMul(B,A){
  const C=new Array(16);
  let sum;
  for (let i=0;i<4;++i)
    for (let j=0;j<4;++j){
      sum=0;
      for (let k=0;k<4;++k)
        sum+= B[i + 4*k] * A[4*j + k];
      C[i + 4*j] = sum;
    }
  return C;
}

export function vMul(A,[x0,x1,x2,x3]){
  x0??=0; x1??=0; x2??=0; x3??=0;
  return new Float32Array([A[0]*x0+A[4]*x1+A[8]*x2+A[12]*x3, A[1]*x0+A[5]*x1+A[9]*x2+A[13]*x3, A[2]*x0+A[6]*x1+A[10]*x2+A[14]*x3, A[3]*x0+A[7]*x1+A[11]*x2+A[15]*x3]);
}

export function  persp(fov, aspR, near, far) {
  const f = tan(pi * 0.5 - 0.5 * fov);
  const nfInv = 1.0 / (near - far);
  return [f/aspR, 0, 0, 0, 0, f, 0, 0, 0, 0, nfInv*(far + near), -1, 0, 0, 2*far*near*nfInv, 0];
}

export function cMaj(A){return A;}
export function rMaj(A){return T(A);}

export function camMat([tx,ty,tz],azim,elev,d){
  // The function camMat calculates the camera matrix (similar to lookAt, but with different input parameters)
  // tx,ty,tz: target coordinates
  // azim: azimuth angle in radians
  // elev: elevation angle in radians
  // d: distance of camera from target. 
  tx??=0; ty??=0; tz??=0; d??=0;
  const s=sin(azim),
        c=cos(azim),
        se=sin(elev),
        ce=cos(elev);
  return new Float32Array([-s, -c*se, c*ce, 0, c, -s*se, ce*s, 0, 0, ce, se, 0, -c*ty + s*tx, c*se*tx - ce*tz + s*se*ty, -c*ce*tx - ce*s*ty - d - se*tz, 1])
};

export function icamMat(t,C,d){
  // The function icamMat calculates the inverse of the camera matrix for a given camera matrix
  // t: target coordinates
  // C: camera matrix
  // d: distance of camera from target. 
  d??=0;
  return new Float32Array([C[0], C[4], C[8], 0, C[1], C[5], C[9], 0, C[2], C[6], C[10], 0, C[2]*d+t[0]??0, C[6]*d+t[1]??0, C[10]*d+t[2]??0, 1])
};

export function camPos(targ,camMat,d){
  //camera position in world coordinates  // tx,ty,tz: target coordinates
  // camMat: camera matrix
  // d: distance of camera from target. 
  const [tx,ty,tz]=targ;
  const ex=camMat[2], ey=camMat[6], ez=camMat[10];
  return [tx+ex*d,ty+ey*d,tz+ez*d,1];
};


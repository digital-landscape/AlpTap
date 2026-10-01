// Original implementation of light-space depth shadows; no MapLibre private APIs.
const terrain = `
uniform highp sampler2D heights;
uniform vec2 extent;
uniform float exaggeration;
uniform mat3 basis;
uniform vec3 low;
uniform vec3 span;
float elevation(ivec2 p) { return texelFetch(heights, clamp(p,ivec2(0),textureSize(heights,0)-1),0).r; }
vec3 world(vec2 uv,float h) { return vec3((uv.x-.5)*extent.x,(.5-uv.y)*extent.y,h*exaggeration); }
vec3 light(vec3 p) { vec3 q=(basis*p-low)/span; return vec3(q.xy,1.-q.z); }
`;
const vertex = `#version 300 es
precision highp float;
${terrain}
void main(){ ivec2 size=textureSize(heights,0); ivec2 cell=ivec2(gl_VertexID%size.x,gl_VertexID/size.x);
 vec2 uv=vec2(cell)/vec2(size-1); gl_Position=vec4(light(world(uv,elevation(cell)))*2.-1.,1.); }`;
const triangle = `#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=vec2(p.x,1.-p.y);gl_Position=vec4(p*2.-1.,0.,1.);}`;
const fragment = `#version 300 es
precision highp float;
${terrain}
uniform highp sampler2D shadowDepth;
uniform vec3 sun;
in vec2 uv;
out vec4 color;
void main(){
 ivec2 size=textureSize(heights,0); vec2 grid=uv*vec2(size-1); ivec2 cell=min(ivec2(grid),size-2); vec2 f=grid-vec2(cell);
 float a=elevation(cell),b=elevation(cell+ivec2(1,0)),c=elevation(cell+ivec2(0,1)),d=elevation(cell+ivec2(1,1));
 // Match the depth mesh's diagonal instead of a bilinear receiving surface.
 float h=f.x+f.y<=1. ? a+(b-a)*f.x+(c-a)*f.y : d+(c-d)*(1.-f.x)+(b-d)*(1.-f.y);
 vec3 p=light(world(uv,h));
 vec2 stepMeters=extent/vec2(size-1);
 vec2 gradient=vec2(b-a,a-c)*exaggeration/stepMeters;
 vec3 normal=normalize(vec3(-gradient,1.));
 float incidence=max(0.,dot(normal,sun));
 float blocked=0.; vec2 texel=1./vec2(textureSize(shadowDepth,0));
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 q=p.xy+vec2(x,y)*texel;
  if(all(greaterThanEqual(q,vec2(0)))&&all(lessThanEqual(q,vec2(1))))
   blocked+=p.z-max(2./span.z,1.5/1024.)>texture(shadowDepth,q).r ? 1./9. : 0.;
 }
 float daylight=smoothstep(-.08,.12,sun.z);
 float opacity=mix(.34, .12*(1.-incidence)+.28*blocked,daylight);
 // Fade only the outer border of the padded elevation scene.
 float edge=min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y));
 color=vec4(.045,.065,.09,opacity*smoothstep(0.,.035,edge));
}`;
export class SolarShadowRenderer {
  readonly canvas = document.createElement('canvas');
  private gl: WebGL2RenderingContext;
  private depthProgram: WebGLProgram;
  private maskProgram: WebGLProgram;
  private heights: WebGLTexture;
  private depth: WebGLTexture;
  private framebuffer: WebGLFramebuffer;
  private indices: WebGLBuffer;
  private vao: WebGLVertexArrayObject;
  constructor() {
    this.canvas.width = this.canvas.height = 384;
    const gl = this.canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('Solar shadows require WebGL 2');
    this.gl = gl;
    try {
    const program = (vs: string, fs: string) => {
      const shaders = [vs, fs].map((source, i) => {
        const shader = gl.createShader(i ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER)!;
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const error = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(error ?? 'Shadow shader failed'); }
        return shader;
      });
      const result = gl.createProgram()!; shaders.forEach(s => gl.attachShader(result, s)); gl.linkProgram(result); shaders.forEach(s => gl.deleteShader(s));
      if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result) ?? 'Shadow program failed');
      return result;
    };
    this.depthProgram = program(vertex, '#version 300 es\nprecision highp float;\nvoid main(){}');
    this.maskProgram = program(triangle, fragment);
    this.heights = gl.createTexture()!; this.depth = gl.createTexture()!;
    this.framebuffer = gl.createFramebuffer()!; this.indices = gl.createBuffer()!; this.vao = gl.createVertexArray()!;
    for (const texture of [this.heights, this.depth]) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, this.depth); gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, 1024, 1024, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depth, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Shadow depth target unavailable');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } catch (error) { gl.getExtension('WEBGL_lose_context')?.loseContext(); throw error; }
  }
  render(heights: Float32Array, size: number, extent: [number, number], sun: [number, number, number], exaggeration: number) {
    const gl = this.gl;
    if (gl.isContextLost()) throw new Error('Shadow context lost');
    const horizontal = Math.hypot(sun[0], sun[1]);
    const right = horizontal > 1e-6 ? [sun[1]/horizontal, -sun[0]/horizontal, 0] : [1,0,0];
    const up = [sun[1]*right[2]-sun[2]*right[1], sun[2]*right[0]-sun[0]*right[2], sun[0]*right[1]-sun[1]*right[0]];
    const axes = [right, up, sun];
    let minH = Infinity, maxH = -Infinity;
    for (const height of heights) { minH = Math.min(minH, height*exaggeration); maxH = Math.max(maxH, height*exaggeration); }
    const low = [Infinity,Infinity,Infinity], high = [-Infinity,-Infinity,-Infinity];
    for (const x of [-extent[0]/2,extent[0]/2]) for (const y of [-extent[1]/2,extent[1]/2]) for (const z of [minH,maxH]) {
      axes.forEach((axis,i) => { const v=axis[0]*x+axis[1]*y+axis[2]*z; low[i]=Math.min(low[i],v-10);high[i]=Math.max(high[i],v+10); });
    }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,this.heights); gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,size,size,0,gl.RED,gl.FLOAT,heights);
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);
    const indices = new Uint32Array((size-1)*(size-1)*6); let offset=0;
    for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const a=y*size+x;indices.set([a,a+size,a+1,a+1,a+size,a+size+1],offset);offset+=6;}
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
    const uniforms = (program: WebGLProgram) => {
      gl.useProgram(program); const location=(name:string)=>gl.getUniformLocation(program,name);
      gl.uniform1i(location('heights'),0);gl.uniform2fv(location('extent'),extent);gl.uniform1f(location('exaggeration'),exaggeration);
      gl.uniformMatrix3fv(location('basis'),false,new Float32Array([right[0],up[0],sun[0],right[1],up[1],sun[1],right[2],up[2],sun[2]]));
      gl.uniform3fv(location('low'),low);gl.uniform3fv(location('span'),high.map((v,i)=>v-low[i]));
    };
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.viewport(0,0,1024,1024);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);
    uniforms(this.depthProgram);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_INT,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.disable(gl.DEPTH_TEST);
    uniforms(this.maskProgram);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.depth);
    gl.uniform1i(gl.getUniformLocation(this.maskProgram,'shadowDepth'),1);gl.uniform3fv(gl.getUniformLocation(this.maskProgram,'sun'),sun);
    gl.drawArrays(gl.TRIANGLES,0,3);
    return this.canvas;
  }
  dispose() { const gl=this.gl;gl.deleteProgram(this.depthProgram);gl.deleteProgram(this.maskProgram);gl.deleteTexture(this.heights);gl.deleteTexture(this.depth);gl.deleteFramebuffer(this.framebuffer);gl.deleteBuffer(this.indices);gl.deleteVertexArray(this.vao);gl.getExtension('WEBGL_lose_context')?.loseContext(); }
}

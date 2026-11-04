// A single bounded GPU layer. It never becomes a dependency of canvas state or input.
export class LandingEffects {
  constructor(canvas) {
    this.canvas = canvas;
    this.events = [];
    this.motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
    this.reduced = this.motionPreference.matches;
    this.motionChanged = event => {
      this.reduced = event.matches;
      if (!this.reduced) return;
      cancelAnimationFrame(this.frame);
      this.frame = null;
      this.event = null;
      this.gl?.clear(this.gl.COLOR_BUFFER_BIT);
    };
    this.motionPreference.addEventListener("change", this.motionChanged);
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    this.gl = gl;
    if (!gl) return;
    const vertex = "attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}";
    const fragment = `precision mediump float;
      uniform vec2 resolution,origin; uniform float age,mode; uniform vec3 colour;
      float random(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec2 uv=gl_FragCoord.xy/resolution;vec2 q=(uv-origin)*vec2(resolution.x/resolution.y,1.);float d=length(q);
      float ring=exp(-pow((d-age*.6)*38.,2.))*(1.-age);float alpha=ring;
      if(mode>1.5){vec2 cell=floor(uv*110.);float particle=step(.96,random(cell));float pulse=exp(-pow((d-age*.5)*12.,2.));alpha=particle*pulse*(1.-age)*.8;}
      else if(mode>.5){alpha=(sin(d*45.-age*20.)*.5+.5)*exp(-d*8.)*(1.-age)*.5;}
      gl_FragColor=vec4(colour,clamp(alpha,0.,.7));}`;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error("Shader compilation failed");
      return shader;
    };
    try {
      this.program = gl.createProgram();
      gl.attachShader(this.program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
        throw new Error("Shader link failed");
      gl.useProgram(this.program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const p = gl.getAttribLocation(this.program, "p");
      gl.enableVertexAttribArray(p);
      gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
      this.uniforms = Object.fromEntries(
        ["resolution", "origin", "age", "mode", "colour"].map((name) => [
          name,
          gl.getUniformLocation(this.program, name),
        ]),
      );
    } catch {
      this.gl = null;
    }
  }
  play(x, y, colour, mode) {
    if (!this.gl || this.reduced || mode === "none") return;
    this.event = { x, y, colour, mode, start: performance.now() };
    if (!this.frame) this.draw();
  }
  draw = () => {
    const gl = this.gl,
      event = this.event;
    if (!gl || !event) return;
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio, 1.5);
    const w = Math.round(rect.width * scale),
      h = Math.round(rect.height * scale);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const age = (performance.now() - event.start) / 1100;
    if (age >= 1) {
      this.frame = null;
      return;
    }
    gl.useProgram(this.program);
    const u = this.uniforms;
    gl.uniform2f(u.resolution, w, h);
    gl.uniform2f(u.origin, event.x, 1 - event.y);
    gl.uniform1f(u.age, age);
    gl.uniform1f(
      u.mode,
      { ripple: 0, liquid: 1, particles: 2 }[event.mode] || 0,
    );
    const hex = event.colour.replace("#", "");
    gl.uniform3f(
      u.colour,
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.frame = requestAnimationFrame(this.draw);
  };
  destroy() {
    this.motionPreference.removeEventListener("change", this.motionChanged);
    cancelAnimationFrame(this.frame);
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

/** Link a shader pair; startup retains ownership until the executable is valid. */
export function createWebGLProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram | null {
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let retained = false;
  function compile(type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }
  try {
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return null;
    program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    // Detachment releases shader attachments while retaining the linked executable.
    gl.detachShader(program, vertex);
    gl.detachShader(program, fragment);
    // Linking also detects compile failures without extra synchronous queries.
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    retained = true;
    return program;
  } finally {
    for (const shader of shaders) gl.deleteShader(shader);
    if (program && !retained) gl.deleteProgram(program);
  }
}

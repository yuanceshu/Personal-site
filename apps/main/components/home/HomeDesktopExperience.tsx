"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteMark } from "@/components/brand/SiteMark";

type PanelName = "about" | "contact";

const DESKTOP_MOTION_QUERY =
  "(min-width: 721px) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

const HOME_PORTAL_VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const HOME_PORTAL_FLOW_SHADER = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uPrevious;
uniform vec2 uMouse;
uniform vec2 uVelocity;
uniform float uRadius;
uniform float uStrength;
uniform float uDecay;
uniform float uAspect;
out vec4 fragColor;

void main() {
  vec4 previous = texture(uPrevious, vUv);
  previous.r *= uDecay;
  previous.gb = mix(vec2(0.5), previous.gb, uDecay);

  vec2 mouseDelta = vUv - uMouse;
  mouseDelta.x *= uAspect;
  float distanceToMouse = length(mouseDelta);
  float influence = exp(-distanceToMouse * distanceToMouse / (uRadius * uRadius * 0.5));
  influence = max(0.0, influence - 0.01);

  float speed = length(uVelocity);
  float strength = uStrength * (0.4 + min(speed * 24.0, 0.6));
  previous.r = max(previous.r, influence * strength);

  float blendAmount = influence * min(strength, 0.4) * 0.3;
  previous.g = mix(previous.g, clamp(uVelocity.x * 2.0 + 0.5, 0.0, 1.0), blendAmount);
  previous.b = mix(previous.b, clamp(uVelocity.y * 2.0 + 0.5, 0.0, 1.0), blendAmount);

  fragColor = previous;
}`;

const HOME_PORTAL_IMAGE_SHADER = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uImage;
  uniform sampler2D uFlow;
uniform vec2 uImageSize;
uniform vec2 uResolution;
out vec4 fragColor;

vec2 coverUv(vec2 uv) {
  float imageAspect = uImageSize.x / uImageSize.y;
  float viewAspect = uResolution.x / uResolution.y;
  vec2 sampleScale = vec2(1.0);

  if (imageAspect > viewAspect) {
    sampleScale.x = viewAspect / imageAspect;
  } else {
    sampleScale.y = imageAspect / viewAspect;
  }

  return clamp((uv - 0.5) * sampleScale + 0.5, 0.0, 1.0);
}

void main() {
  vec4 flow = texture(uFlow, vUv);
  float influence = clamp(flow.r, 0.0, 1.0);
  vec2 direction = (flow.gb - 0.5) * 2.0;
  vec2 offset = direction * influence * vec2(0.014, 0.018);

  vec2 baseUv = coverUv(vUv);
  vec2 refractedUv = coverUv(vUv + offset);
  vec3 baseColor = texture(uImage, baseUv).rgb;
  vec3 refractedColor = texture(uImage, refractedUv).rgb;
  vec3 color = mix(baseColor, refractedColor, min(influence * 0.68, 0.68));
  float glow = smoothstep(0.04, 0.72, influence);
  color += vec3(0.035, 0.075, 0.12) * glow;

  fragColor = vec4(color, 1.0);
}`;

type HomePortalFlowTarget = {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
};

function createHomePortalShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createHomePortalProgram(
  gl: WebGL2RenderingContext,
  fragmentSource: string,
) {
  const vertexShader = createHomePortalShader(gl, gl.VERTEX_SHADER, HOME_PORTAL_VERTEX_SHADER);
  const fragmentShader = createHomePortalShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function createHomePortalTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  pixels: Uint8Array | null = null,
) {
  const texture = gl.createTexture();
  if (!texture) {
    return null;
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixels,
  );
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

function createHomePortalFlowTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): HomePortalFlowTarget | null {
  const texture = createHomePortalTexture(gl, width, height);
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) {
    if (texture) gl.deleteTexture(texture);
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    return null;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  if (!complete) {
    gl.deleteTexture(texture);
    gl.deleteFramebuffer(framebuffer);
    return null;
  }

  return { framebuffer, texture };
}

function createHomePortalField(canvas: HTMLCanvasElement) {
  const motionQuery = window.matchMedia(DESKTOP_MOTION_QUERY);
  if (!motionQuery.matches) {
    return () => undefined;
  }

  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  });
  if (!gl) {
    return () => undefined;
  }

  const flowProgram = createHomePortalProgram(gl, HOME_PORTAL_FLOW_SHADER);
  const imageProgram = createHomePortalProgram(gl, HOME_PORTAL_IMAGE_SHADER);
  const positionBuffer = gl.createBuffer();
  if (!flowProgram || !imageProgram || !positionBuffer) {
    if (flowProgram) gl.deleteProgram(flowProgram);
    if (imageProgram) gl.deleteProgram(imageProgram);
    if (positionBuffer) gl.deleteBuffer(positionBuffer);
    return () => undefined;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const flowPosition = gl.getAttribLocation(flowProgram, "aPosition");
  const imagePosition = gl.getAttribLocation(imageProgram, "aPosition");
  const flowUniforms = {
    previous: gl.getUniformLocation(flowProgram, "uPrevious"),
    mouse: gl.getUniformLocation(flowProgram, "uMouse"),
    velocity: gl.getUniformLocation(flowProgram, "uVelocity"),
    radius: gl.getUniformLocation(flowProgram, "uRadius"),
    strength: gl.getUniformLocation(flowProgram, "uStrength"),
    decay: gl.getUniformLocation(flowProgram, "uDecay"),
    aspect: gl.getUniformLocation(flowProgram, "uAspect"),
  };
  const imageUniforms = {
    image: gl.getUniformLocation(imageProgram, "uImage"),
    flow: gl.getUniformLocation(imageProgram, "uFlow"),
    imageSize: gl.getUniformLocation(imageProgram, "uImageSize"),
    resolution: gl.getUniformLocation(imageProgram, "uResolution"),
  };

  let imageTexture: WebGLTexture | null = null;
  let sourceFlow: HomePortalFlowTarget | null = null;
  let targetFlow: HomePortalFlowTarget | null = null;
  let flowWidth = 0;
  let flowHeight = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let frameId = 0;
  let lastFrame = 0;
  let lastPointer = 0;
  let isRunning = false;
  let isDestroyed = false;
  let isReady = false;
  let isPointerInside = false;
  const targetMouse = { x: 0.72, y: 0.52 };
  const currentMouse = { ...targetMouse };
  const velocity = { x: 0, y: 0 };

  const deleteFlowTarget = (flowTarget: HomePortalFlowTarget | null) => {
    if (!flowTarget) return;
    gl.deleteFramebuffer(flowTarget.framebuffer);
    gl.deleteTexture(flowTarget.texture);
  };

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1);
    const nextWidth = Math.max(1, Math.round(width * pixelRatio));
    const nextHeight = Math.max(1, Math.round(height * pixelRatio));
    const nextFlowWidth = Math.max(1, Math.round(nextWidth / 4));
    const nextFlowHeight = Math.max(1, Math.round(nextHeight / 4));

    if (
      nextWidth === canvasWidth &&
      nextHeight === canvasHeight &&
      nextFlowWidth === flowWidth &&
      nextFlowHeight === flowHeight
    ) {
      return;
    }

    canvasWidth = nextWidth;
    canvasHeight = nextHeight;
    flowWidth = nextFlowWidth;
    flowHeight = nextFlowHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    deleteFlowTarget(sourceFlow);
    deleteFlowTarget(targetFlow);
    sourceFlow = createHomePortalFlowTarget(gl, flowWidth, flowHeight);
    targetFlow = createHomePortalFlowTarget(gl, flowWidth, flowHeight);

    if (sourceFlow && targetFlow) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, sourceFlow.framebuffer);
      gl.viewport(0, 0, flowWidth, flowHeight);
      gl.clearColor(0, 0.5, 0.5, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, targetFlow.framebuffer);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  };

  const bindPosition = (program: WebGLProgram, attribute: number) => {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
  };

  const render = (strength: number) => {
    if (!imageTexture || !sourceFlow || !targetFlow || !isReady) return;

    currentMouse.x += (targetMouse.x - currentMouse.x) * 0.1;
    currentMouse.y += (targetMouse.y - currentMouse.y) * 0.1;
    velocity.x += ((targetMouse.x - currentMouse.x) * 0.5 - velocity.x) * 0.2;
    velocity.y += ((targetMouse.y - currentMouse.y) * 0.5 - velocity.y) * 0.2;

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFlow.framebuffer);
    gl.viewport(0, 0, flowWidth, flowHeight);
    bindPosition(flowProgram, flowPosition);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceFlow.texture);
    gl.uniform1i(flowUniforms.previous, 0);
    gl.uniform2f(flowUniforms.mouse, currentMouse.x, currentMouse.y);
    gl.uniform2f(flowUniforms.velocity, velocity.x, velocity.y);
    gl.uniform1f(flowUniforms.radius, 0.12);
    gl.uniform1f(flowUniforms.strength, strength);
    gl.uniform1f(flowUniforms.decay, 0.925);
    gl.uniform1f(flowUniforms.aspect, canvasHeight ? canvasWidth / canvasHeight : 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const previousSource = sourceFlow;
    sourceFlow = targetFlow;
    targetFlow = previousSource;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasWidth, canvasHeight);
    bindPosition(imageProgram, imagePosition);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.uniform1i(imageUniforms.image, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, sourceFlow.texture);
    gl.uniform1i(imageUniforms.flow, 1);
    gl.uniform2f(imageUniforms.imageSize, 1920, 1080);
    gl.uniform2f(imageUniforms.resolution, canvasWidth, canvasHeight);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const tick = (time: number) => {
    if (isDestroyed || !isRunning) return;

    if (time - lastFrame < 1000 / 30) {
      frameId = window.requestAnimationFrame(tick);
      return;
    }

    lastFrame = time;
    render(isPointerInside ? 1.8 : 0);

    if (time - lastPointer < 1600) {
      frameId = window.requestAnimationFrame(tick);
    } else {
      isRunning = false;
      frameId = 0;
    }
  };

  const start = () => {
    if (isDestroyed || !isReady || document.hidden || isRunning) return;
    isRunning = true;
    frameId = window.requestAnimationFrame(tick);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!motionQuery.matches) return;
    const rect = canvas.getBoundingClientRect();
    targetMouse.x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    targetMouse.y = Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height));
    isPointerInside = true;
    lastPointer = performance.now();
    start();
  };

  const handlePointerLeave = () => {
    isPointerInside = false;
    lastPointer = performance.now();
    start();
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      isRunning = false;
    }
  };

  const handleResize = () => {
    if (!motionQuery.matches) return;
    resize();
    if (isReady) {
      render(0);
    }
  };

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    isReady = false;
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    isRunning = false;
    canvas.style.opacity = "0";
  };

  const image = new window.Image();
  image.decoding = "async";
  image.onload = () => {
    if (isDestroyed) return;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    imageTexture = gl.createTexture();
    if (!imageTexture) return;
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.bindTexture(gl.TEXTURE_2D, null);
    resize();
    isReady = Boolean(sourceFlow && targetFlow);
    render(0);
    canvas.style.opacity = isReady ? "1" : "0";
  };
  image.onerror = () => {
    if (!image.src.endsWith(".jpg")) {
      image.src = "/home/portal/gallery-hall-desktop.jpg";
    }
  };
  image.src = "/home/portal/gallery-hall-desktop.avif";

  canvas.addEventListener("webglcontextlost", handleContextLost, false);
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  document.documentElement.addEventListener("mouseleave", handlePointerLeave);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("resize", handleResize, { passive: true });

  return () => {
    isDestroyed = true;
    if (frameId) window.cancelAnimationFrame(frameId);
    canvas.removeEventListener("webglcontextlost", handleContextLost);
    window.removeEventListener("pointermove", handlePointerMove);
    document.documentElement.removeEventListener("mouseleave", handlePointerLeave);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("resize", handleResize);
    deleteFlowTarget(sourceFlow);
    deleteFlowTarget(targetFlow);
    if (imageTexture) gl.deleteTexture(imageTexture);
    gl.deleteProgram(flowProgram);
    gl.deleteProgram(imageProgram);
    gl.deleteBuffer(positionBuffer);
  };
}

export function HomeDesktopExperience({
  jingmiansenUrl,
}: {
  jingmiansenUrl: string;
}) {
  const [activePanel, setActivePanel] = useState<PanelName | null>(null);
  const [renderedPanel, setRenderedPanel] = useState<PanelName | null>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const closePanel = useCallback(() => {
    setActivePanel(null);
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => setRenderedPanel(null), 180);
    requestAnimationFrame(() => lastTriggerRef.current?.focus());
  }, []);

  const openPanel = useCallback(
    (panel: PanelName, trigger: HTMLButtonElement) => {
      const isPanelTab = panelRef.current?.contains(trigger) ?? false;
      if (!isPanelTab) {
        lastTriggerRef.current = trigger;
      }

      if (activePanel === panel) {
        if (!isPanelTab) {
          closePanel();
        }
        return;
      }

      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setRenderedPanel(panel);
      setActivePanel(panel);
    },
    [activePanel, closePanel],
  );

  useEffect(() => {
    if (!activePanel) {
      return;
    }

    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePanel, closePanel]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    return createHomePortalField(field);
  }, []);

  return (
    <div className="home-desktop-experience">
      <div ref={backgroundRef} className="home-gallery-background" aria-hidden="true" />
      <canvas ref={fieldRef} className="home-gallery-field" aria-hidden="true" />
      <div className="home-gallery-overlay" aria-hidden="true" />

      <header className="home-portal-header">
        <Link className="home-portal-brand" href="/" aria-label="袁策书的个人作品首页">
          <SiteMark className="home-portal-brand__mark" tone="light" />
          <span>袁策书</span>
          <small>作品与实验</small>
        </Link>

        <nav aria-label="桌面主页导航">
          <Link href="/works/project-000">作品</Link>
          <a href={jingmiansenUrl} referrerPolicy="no-referrer">
            静眠森
          </a>
          <button
            type="button"
            aria-controls="home-info-panel"
            aria-expanded={activePanel === "about"}
            onClick={(event) => openPanel("about", event.currentTarget)}
          >
            认识我
          </button>
          <button
            type="button"
            aria-controls="home-info-panel"
            aria-expanded={activePanel === "contact"}
            onClick={(event) => openPanel("contact", event.currentTarget)}
          >
            保持联系
          </button>
        </nav>
      </header>

      <aside
        ref={panelRef}
        id="home-info-panel"
        className="home-info-panel"
        data-open={activePanel ? "true" : "false"}
        aria-hidden={!activePanel}
        inert={!activePanel}
      >
        <div className="home-info-panel__topline">
          <span>{renderedPanel === "contact" ? "保持联系" : "认识我"}</span>
          <button
            ref={closeButtonRef}
            className="home-info-panel__close"
            type="button"
            onClick={closePanel}
            aria-label="关闭信息面板"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="home-info-panel__tabs" role="tablist" aria-label="辅助信息">
          <button
            type="button"
            role="tab"
            aria-selected={activePanel === "about"}
            onClick={(event) => openPanel("about", event.currentTarget)}
          >
            认识我
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePanel === "contact"}
            onClick={(event) => openPanel("contact", event.currentTarget)}
          >
            保持联系
          </button>
        </div>

        {renderedPanel === "about" ? (
          <div className="home-info-panel__content">
            <p className="home-info-panel__lead">
              我喜欢把模糊的问题理清楚，再把它们做成可以被真实体验的东西。
            </p>
            <p>
              INFJ，喜欢 AI 与心理学，也还在认真生活、工作和学习。如果你也在认真走自己的路，愿我们做彼此的学伴——岁岁成长，一路同行。
            </p>
            <dl className="home-info-panel__facts">
              <div>
                <dt>现在</dt>
                <dd>金融行业，产品 / 售前</dd>
              </div>
              <div>
                <dt>持续关注</dt>
                <dd>AI、心理学与真实体验</dd>
              </div>
              <div>
                <dt>保持</dt>
                <dd>努力生活、工作和学习</dd>
              </div>
            </dl>
          </div>
        ) : null}

        {renderedPanel === "contact" ? (
          <div className="home-info-panel__content home-info-panel__contact">
            <p className="eyebrow">公众号</p>
            <h2>小袁AI感雾</h2>
            <p>不定期分享 AI 产品实践、学习心得与生活感悟。不追光，只生长。</p>
            <Image
              className="home-info-panel__qr"
              src="/profile/wechat-official-account-qr.png"
              alt="小袁AI感雾微信公众号二维码"
              width={920}
              height={920}
              sizes="12rem"
            />
            <small>使用微信扫码关注</small>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

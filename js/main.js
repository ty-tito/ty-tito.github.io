(() => {
  "use strict";

  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();

  /* ---------- Small details ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

  // Show initials until assets/img/profile.jpg exists
  document.querySelectorAll("[data-avatar] img").forEach((img) => {
    const fail = () => img.closest("[data-avatar]").classList.add("no-photo");
    if (img.complete && img.naturalWidth === 0) fail();
    else img.addEventListener("error", fail);
  });

  // Links still waiting on a URL read as unavailable, not as working buttons that do nothing
  document.querySelectorAll('a[data-todo][href="#"]').forEach((a) => {
    a.setAttribute("aria-disabled", "true");
    a.title = `${a.dataset.todo} — coming soon`;
    a.addEventListener("click", (e) => e.preventDefault());
  });

  // Native controls are the no-script fallback; the page provides its own when JS runs
  document.querySelectorAll("video[controls]").forEach((v) => v.removeAttribute("controls"));

  /* ---------- Planetary gear illustration ---------- */
  // One stage: sun 12T, planets 18T, ring 48T -> 5:1 with the ring fixed.
  // Sun 8 s/rev, carrier 40 s/rev, planets spin -24 deg/s relative to the carrier (15 s/rev).
  function gearPath(z, r, m, { internal = false, phase = 0 } = {}) {
    const pitch = (2 * Math.PI) / z;
    const tip = internal ? r - m : r + m;
    const base = internal ? r + 1.25 * m : r - 1.25 * m;
    const wBase = pitch * 0.29;
    const wTip = pitch * 0.16;
    let d = "";
    for (let i = 0; i < z; i++) {
      const c = phase + i * pitch;
      [[base, c - wBase], [tip, c - wTip], [tip, c + wTip], [base, c + wBase]].forEach(([rr, a], j) => {
        d += `${i === 0 && j === 0 ? "M" : "L"}${(rr * Math.cos(a)).toFixed(2)} ${(rr * Math.sin(a)).toFixed(2)}`;
      });
    }
    return `${d}Z`;
  }

  function buildGearset(el) {
    const m = 3.2, zs = 12, zp = 18, zr = 48;
    const rs = (m * zs) / 2, rp = (m * zp) / 2, rr = (m * zr) / 2;
    const centre = rs + rp;
    const ro = rr + 1.25 * m + 6;
    const ring = `M${ro} 0A${ro} ${ro} 0 1 0 ${-ro} 0A${ro} ${ro} 0 1 0 ${ro} 0Z${gearPath(zr, rr, m, { internal: true })}`;
    const planet = gearPath(zp, rp, m, { phase: Math.PI / zp });
    const planets = [0, 120, 240]
      .map((t) => `<g transform="rotate(${t}) translate(${centre} 0)"><g class="gs-planet"><path d="${planet}"/><circle class="gs-pin" r="4.5"/></g></g>`)
      .join("");
    el.innerHTML =
      `<svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false"><g transform="rotate(-90)">` +
      `<path class="gs-ring" fill-rule="evenodd" d="${ring}"/>` +
      `<circle class="gs-orbit" r="${centre}"/>` +
      `<g class="gs-carrier">${planets}</g>` +
      `<g class="gs-sun"><path d="${gearPath(zs, rs, m)}"/><circle class="gs-hub" r="5"/></g>` +
      `</g></svg>`;
    if (el.dataset.gearset === "static" || reduceMotion) el.classList.add("gearset--static");
  }
  document.querySelectorAll("[data-gearset]").forEach(buildGearset);

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((e, i) => {
        e.target.style.setProperty("--d", `${Math.min(i, 5) * 70}ms`);
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- Scroll progress: sidebar chain, spine, ambient tint ---------- */
  const navItems = [...document.querySelectorAll("[data-nav]")];
  const sections = navItems.map((li) => document.getElementById(li.dataset.nav));
  const chainFill = document.querySelector("[data-chain-fill]");
  const spine = document.querySelector(".spine");
  const journey = document.querySelector("[data-journey]");

  const tints = {
    hw: [cssVar("--hw"), cssVar("--hw")],
    mix: [cssVar("--hw"), cssVar("--sim")],
    sim: [cssVar("--sim"), cssVar("--sim")],
    neutral: [cssVar("--text-2"), cssVar("--sim")],
  };
  let currentTint = "";
  let currentActive = -2;

  function setSpineStops() {
    if (!spine) return;
    const s = spine.getBoundingClientRect();
    const at = (id) => `${clamp(((document.getElementById(id).getBoundingClientRect().top - s.top) / s.height) * 100, 0, 100)}%`;
    spine.style.setProperty("--s3", at("motion"));
    spine.style.setProperty("--s4", at("learning"));
    spine.style.setProperty("--s5", at("skills"));
  }

  function update() {
    const vh = window.innerHeight;
    const line = vh * 0.4;

    let active = -1;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) active = i; });

    // Sidebar chain: whole steps for finished sections, a fraction for the current one
    let p = 0;
    if (active >= 0) {
      const cur = sections[active].getBoundingClientRect();
      const next = sections[active + 1] && sections[active + 1].getBoundingClientRect();
      const frac = next ? clamp((line - cur.top) / (next.top - cur.top), 0, 1) : 0;
      p = (active + frac) / (sections.length - 1);
    }
    if (chainFill) chainFill.style.setProperty("--p", p.toFixed(4));

    if (active !== currentActive) {
      currentActive = active;
      navItems.forEach((li, i) => {
        li.classList.toggle("is-active", i === active);
        li.classList.toggle("is-done", i < active);
        const a = li.querySelector("a");
        if (i === active) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }

    // Main spine
    if (spine) {
      const r = spine.getBoundingClientRect();
      const sp = clamp((vh * 0.55 - r.top) / r.height, 0, 1);
      spine.style.setProperty("--p", sp.toFixed(4));
      spine.style.setProperty("--head-o", sp > 0.001 && sp < 0.97 ? 1 : 0);
    }

    // Ambient tint follows the section in view
    const key = active >= 0 ? sections[active].dataset.tint : "hw";
    if (key !== currentTint && tints[key]) {
      currentTint = key;
      root.style.setProperty("--tint", tints[key][0]);
      root.style.setProperty("--tint-2", tints[key][1]);
    }
  }

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { setSpineStops(); onScroll(); });
  window.addEventListener("load", () => { setSpineStops(); update(); });
  if (journey && "ResizeObserver" in window) new ResizeObserver(setSpineStops).observe(journey);
  setSpineStops();
  update();

  /* ---------- Autoplay videos only while on screen ---------- */
  const inView = new WeakMap();
  const autoVideos = document.querySelectorAll("video[data-autoplay]");
  if ("IntersectionObserver" in window) {
    const vio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const v = e.target;
        const visible = e.intersectionRatio >= 0.35;
        inView.set(v, visible);
        if (visible && !reduceMotion && !v.dataset.userPaused) v.play().catch(() => {});
        else if (!visible) v.pause();
      });
    }, { threshold: [0, 0.35] });
    autoVideos.forEach((v) => vio.observe(v));
  }
  // Looping clips need a visible, keyboard-reachable pause (WCAG 2.2.2); clicking the video works too
  const toggleVideo = (v) => {
    if (v.paused) { delete v.dataset.userPaused; v.play().catch(() => {}); }
    else { v.dataset.userPaused = "1"; v.pause(); }
  };
  autoVideos.forEach((v) => {
    v.addEventListener("click", () => toggleVideo(v));
    const pane = v.closest(".pane");
    const btn = pane && pane.querySelector("[data-video-toggle]");
    if (!btn) return;
    const sync = () => {
      pane.classList.toggle("is-playing", !v.paused);
      btn.setAttribute("aria-label", v.paused ? "Play video" : "Pause video");
    };
    ["play", "pause", "emptied"].forEach((ev) => v.addEventListener(ev, sync));
    btn.addEventListener("click", () => toggleVideo(v));
    sync();
  });

  /* ---------- Hardware / simulation synced player ---------- */
  document.querySelectorAll("[data-sync]").forEach((fig) => {
    const [lead, follow] = fig.querySelectorAll("video");
    const toggle = fig.querySelector("[data-sync-toggle]");
    const scrub = fig.querySelector("[data-sync-scrub]");
    let userPaused = reduceMotion;
    let visible = false;
    let raf = 0;
    let scrubbing = false;

    const duration = () => lead.duration || follow.duration || 0;

    function render() {
      const d = duration();
      if (scrubbing || !d) return;
      const f = lead.currentTime / d;
      scrub.value = Math.round(f * 1000);
      scrub.style.setProperty("--v", f.toFixed(4));
      scrub.setAttribute("aria-valuetext", `${Math.round(f * 100)}% through the cycle`);
    }

    // Keep the follower locked to the lead clip
    function loop() {
      const drift = follow.currentTime - lead.currentTime;
      if (Math.abs(drift) > 0.2) {
        follow.currentTime = lead.currentTime;
        follow.playbackRate = lead.playbackRate;
      } else if (Math.abs(drift) > 0.03) {
        follow.playbackRate = lead.playbackRate * (drift > 0 ? 0.95 : 1.05);
      } else {
        follow.playbackRate = lead.playbackRate;
      }
      render();
      raf = requestAnimationFrame(loop);
    }

    function play() {
      follow.currentTime = lead.currentTime;
      Promise.all([lead.play(), follow.play()]).catch(() => {});
    }
    function pause() {
      lead.pause();
      follow.pause();
    }

    lead.addEventListener("play", () => {
      fig.classList.add("is-playing");
      toggle.setAttribute("aria-label", "Pause both videos");
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    });
    lead.addEventListener("pause", () => {
      fig.classList.remove("is-playing");
      toggle.setAttribute("aria-label", "Play both videos");
      cancelAnimationFrame(raf);
      follow.pause();
      render();
    });
    lead.addEventListener("waiting", () => follow.pause());
    lead.addEventListener("playing", () => { if (follow.paused) follow.play().catch(() => {}); });
    lead.addEventListener("ended", () => {
      lead.currentTime = 0;
      follow.currentTime = 0;
      if (!userPaused && visible) play();
    });
    lead.addEventListener("loadedmetadata", render);
    lead.addEventListener("seeked", render);

    toggle.addEventListener("click", () => {
      if (lead.paused) { userPaused = false; play(); }
      else { userPaused = true; pause(); }
    });

    scrub.addEventListener("input", () => {
      scrubbing = true;
      const t = (scrub.value / 1000) * duration();
      scrub.style.setProperty("--v", scrub.value / 1000);
      lead.currentTime = t;
      follow.currentTime = t;
      scrub.setAttribute("aria-valuetext", `${Math.round(scrub.value / 10)}% through the cycle`);
    });
    scrub.addEventListener("change", () => { scrubbing = false; });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => {
        visible = e.intersectionRatio >= 0.3;
        if (visible && !userPaused) play();
        else if (!visible) pause();
      }, { threshold: [0, 0.3] }).observe(fig);
    }
    render();
  });

  /* ---------- RL shape tabs ---------- */
  document.querySelectorAll("[data-tabs]").forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const panel = document.getElementById(tabs[0].getAttribute("aria-controls"));
    const video = panel.querySelector("[data-rl-video]");
    const plot = panel.querySelector("[data-rl-plot]");
    let swapTimer = 0;

    function select(tab, focus) {
      if (tab.getAttribute("aria-selected") === "true") return;
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tab.focus();
      panel.setAttribute("aria-labelledby", tab.id);

      panel.classList.add("is-switching");
      clearTimeout(swapTimer);
      swapTimer = setTimeout(() => {
        video.poster = tab.dataset.poster;
        video.src = tab.dataset.video;
        plot.src = tab.dataset.plot;
        plot.alt = `Plot of commanded and actual pen path for the ${tab.dataset.name}: the two lines overlap closely after the pen reaches the start point`;
        video.load();
        if (inView.get(video) && !reduceMotion) {
          delete video.dataset.userPaused;
          video.play().catch(() => {});
        }
        const done = () => panel.classList.remove("is-switching");
        video.addEventListener("loadeddata", done, { once: true });
        setTimeout(done, 700);
      }, 180);
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab, false));
      tab.addEventListener("keydown", (e) => {
        let j = -1;
        if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") j = 0;
        else if (e.key === "End") j = tabs.length - 1;
        if (j >= 0) { e.preventDefault(); select(tabs[j], true); }
      });
    });

    // Warm the cache so switching shapes is instant
    tabs.forEach((t) => { const img = new Image(); img.src = t.dataset.plot; });
  });

  /* ---------- Exploded gearbox: scrolling scrubs the animation ---------- */
  // Reduced motion (or no IntersectionObserver) keeps the static exploded still.
  document.querySelectorAll("[data-explode]").forEach((fig) => {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    const count = Number(fig.dataset.frames);
    const src = (i) => fig.dataset.src.replace("{n}", String(i).padStart(3, "0"));
    const track = fig.querySelector(".explode-track");
    const stage = fig.querySelector(".explode-stage");
    const still = fig.querySelector(".explode-still");
    const canvas = fig.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const meter = fig.querySelector(".explode-meter");
    const sidebar = document.querySelector(".sidebar");
    const frames = new Array(count);
    let want = 0;
    let shown = -1;
    let stickyTop = 0;

    fig.classList.add("is-scrub");
    still.src = src(0); // until the canvas paints, show the assembled gearbox rather than the end state

    // Draw the wanted frame, or the nearest one that has arrived
    function draw() {
      let i = want;
      for (let d = 1; !frames[i] && d < count; d++) {
        if (frames[want - d]) i = want - d;
        else if (frames[want + d]) i = want + d;
      }
      if (!frames[i] || i === shown) return;
      ctx.drawImage(frames[i], 0, 0, canvas.width, canvas.height);
      shown = i;
      fig.classList.add("is-drawn");
    }

    // Coarse to fine (every 16th frame, then 8th, 4th…) so scrubbing works before everything has loaded
    function load() {
      const seen = new Set([0, count - 1]);
      const order = [0, count - 1];
      for (let step = 16; step >= 1; step >>= 1) {
        for (let i = 0; i < count; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
      }
      let next = 0;
      const pump = () => {
        if (next >= order.length) return;
        const i = order[next++];
        const img = new Image();
        img.onload = () => { frames[i] = img; if (shown !== want) draw(); pump(); };
        img.onerror = pump;
        img.src = src(i);
      };
      for (let k = 0; k < 6; k++) pump();
    }

    // Centre the pinned stage in the viewport, clear of the top bar on small screens
    function measure() {
      const bar = getComputedStyle(sidebar).position === "sticky" ? sidebar.offsetHeight : 0;
      stickyTop = Math.max(bar + 16, (window.innerHeight - stage.offsetHeight) / 2);
      stage.style.top = `${stickyTop}px`;
    }

    function update() {
      const r = track.getBoundingClientRect();
      const p = clamp((stickyTop - r.top) / Math.max(1, r.height - stage.offsetHeight), 0, 1);
      meter.style.setProperty("--p", p.toFixed(4));
      fig.classList.toggle("is-started", p > 0.03);
      want = Math.round(p * (count - 1));
      draw();
    }

    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    }, { passive: true });
    window.addEventListener("resize", () => { measure(); update(); });

    // Start downloading frames a screen or so before the section arrives
    const near = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      near.disconnect();
      load();
    }, { rootMargin: "120% 0px" });
    near.observe(fig);

    measure();
    update();
  });
})();

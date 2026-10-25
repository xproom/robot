/* ROBOT 셀프 챌린지 — static front-end (no backend).
 * All state is kept in localStorage; this is a practice re-implementation,
 * so "login" and "admin comments" are client-side demos, not real auth. */

(function () {
  "use strict";

  var STORE_KEY = "robot_challenge_v1";
  var MS_DAY = 24 * 60 * 60 * 1000;
  var DATA = null;

  /* ---------- storage ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function save(state) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      toast("저장 공간이 가득 찼어요. 인증 이미지를 줄여보세요.");
    }
  }
  var state = load();
  if (!state.progress) state.progress = {};

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function todayMidnight() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function startDate() {
    return state.startDate ? new Date(state.startDate) : todayMidnight();
  }
  function dayUnlockDate(dayNum) {
    return new Date(startDate().getTime() + (dayNum - 1) * MS_DAY);
  }
  function isMaster() {
    return !!(state.auth && state.auth.master);
  }
  function isUnlocked(dayNum) {
    if (state.previewMode || isMaster()) return true;
    return todayMidnight().getTime() >= dayUnlockDate(dayNum).getTime();
  }
  function dayState(dayNum) {
    var p = state.progress[dayNum];
    if (p && p.done) return "done";
    if (!isUnlocked(dayNum)) return "locked";
    // "today" = the earliest unlocked, not-yet-done day
    var firstOpen = null;
    for (var i = 1; i <= DATA.totalDays; i++) {
      if (isUnlocked(i) && !(state.progress[i] && state.progress[i].done)) { firstOpen = i; break; }
    }
    return dayNum === firstOpen ? "today" : "open";
  }
  function completedCount() {
    var c = 0;
    for (var k in state.progress) if (state.progress[k] && state.progress[k].done) c++;
    return c;
  }
  function ddayLabel() {
    var end = new Date(startDate().getTime() + DATA.totalDays * MS_DAY);
    var diff = Math.ceil((end.getTime() - todayMidnight().getTime()) / MS_DAY);
    if (diff > 0) return "D-" + diff;
    if (diff === 0) return "D-DAY";
    return "종료";
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  /* ---------- routing ---------- */
  function go(hash) { window.location.hash = hash; }
  function render() {
    var app = $("#app");
    app.innerHTML = "";
    if (!state.auth) { renderLogin(app); return; }

    var hash = window.location.hash || "#/";
    var m = hash.match(/^#\/day\/(\d+)/);
    if (m) renderDetail(app, parseInt(m[1], 10));
    else renderDashboard(app);
  }

  /* ---------- login ---------- */
  function renderLogin(app) {
    var card = el("div", "card login-card");
    card.appendChild(el("h2", null, "접속하기"));
    card.appendChild(el("p", "help-text", "전화번호와 접속코드를 입력해 입장합니다."));

    var f1 = el("div", "field");
    f1.appendChild(el("label", null, "전화번호"));
    var phone = el("input");
    phone.type = "tel";
    phone.placeholder = "010-0000-0000";
    phone.autocomplete = "tel";
    f1.appendChild(phone);

    var f2 = el("div", "field");
    f2.appendChild(el("label", null, "접속코드"));
    var code = el("input");
    code.type = "text";
    code.placeholder = "접속코드 입력";
    f2.appendChild(code);

    var remember = el("label", "checkbox-row");
    var cb = el("input");
    cb.type = "checkbox";
    remember.appendChild(cb);
    remember.appendChild(document.createTextNode("이 기기에 로그인 상태 저장"));

    var btn = el("button", "btn", "입장하기");
    btn.addEventListener("click", function () {
      var pv = phone.value.trim();
      var cv = code.value.trim();
      if (!pv || !cv) { toast("전화번호와 접속코드를 입력해주세요."); return; }
      // master account: opens every day regardless of the unlock schedule
      var ma = DATA.masterAccount;
      var master = !!ma && digits(pv) === digits(ma.phone) &&
        cv.toUpperCase() === String(ma.code).toUpperCase();
      if (!master && cv.toUpperCase() !== String(DATA.demoAccessCode).toUpperCase()) {
        toast("접속코드가 올바르지 않습니다. (데모 코드: " + DATA.demoAccessCode + ")");
        return;
      }
      state.auth = { phone: pv, savedDevice: cb.checked, master: master };
      if (!state.startDate) state.startDate = todayMidnight().toISOString();
      save(state);
      if (master) toast("마스터 계정으로 입장했어요. 모든 일차가 열립니다.");
      go("#/");
      render();
    });

    var hint = el("p", "help-text");
    hint.innerHTML = "데모 접속코드: <code>" + DATA.demoAccessCode +
      "</code><br>접속코드 재발급은 운영자에게 문의하세요.";

    card.appendChild(f1);
    card.appendChild(f2);
    card.appendChild(remember);
    card.appendChild(btn);
    card.appendChild(hint);
    app.appendChild(card);
  }

  /* ---------- dashboard ---------- */
  function renderDashboard(app) {
    var done = completedCount();
    var total = DATA.totalDays;

    var prog = el("div", "card");
    var head = el("div", "progress-head");
    var title = el("strong", null, "진행 현황");
    if (isMaster()) {
      title.appendChild(document.createTextNode(" "));
      title.appendChild(el("span", "status-chip master", "마스터"));
    }
    head.appendChild(title);
    head.appendChild(el("span", "dday", ddayLabel()));
    prog.appendChild(head);

    var bar = el("div", "progress-bar");
    var fill = el("div", "progress-fill");
    fill.style.width = (total ? Math.round((done / total) * 100) : 0) + "%";
    bar.appendChild(fill);
    prog.appendChild(bar);

    var meta = el("div", "progress-meta");
    meta.appendChild(el("span", null, done + " / " + total + " 완료"));
    meta.appendChild(el("span", null, Math.round((done / total) * 100) + "%"));
    prog.appendChild(meta);
    app.appendChild(prog);

    var listCard = el("div", "card");
    listCard.appendChild(el("strong", null, "일차별 미션"));
    var ul = el("ul", "day-list");
    DATA.days.forEach(function (d) {
      var st = dayState(d.day);
      var li = el("li", "day-item " + st);
      var badge = el("div", "day-badge", st === "done" ? "✓" : "D" + d.day);
      var main = el("div", "day-main");
      main.appendChild(el("div", "d-label", d.day + "일 차"));
      main.appendChild(el("div", "d-title", d.title));
      var chipText = st === "done" ? "완료" : st === "locked" ? "잠김" : st === "today" ? "오늘" : "진행 가능";
      var chipCls = st === "done" ? "done" : st === "locked" ? "locked" : "open";
      var chip = el("span", "status-chip " + chipCls, chipText);
      li.appendChild(badge);
      li.appendChild(main);
      li.appendChild(chip);
      if (st === "locked") {
        li.addEventListener("click", function () {
          toast(d.day + "일 차는 " + fmtDate(dayUnlockDate(d.day)) + "에 열립니다.");
        });
      } else {
        li.addEventListener("click", function () { go("#/day/" + d.day); });
      }
      ul.appendChild(li);
    });
    listCard.appendChild(ul);
    app.appendChild(listCard);

    var tools = el("div", isMaster() ? "" : "row-2");
    var pv = el("button", "btn secondary", state.previewMode ? "미리보기 모드 끄기" : "미리보기 모드 켜기");
    pv.addEventListener("click", function () {
      state.previewMode = !state.previewMode;
      save(state);
      updatePreviewBanner();
      render();
    });
    var out = el("button", "btn secondary", "로그아웃");
    out.addEventListener("click", function () {
      state.auth = null;
      save(state);
      go("#/");
      render();
    });
    // preview mode is redundant for the master account (everything is open)
    if (!isMaster()) tools.appendChild(pv);
    tools.appendChild(out);
    app.appendChild(tools);
  }

  function digits(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function fmtDate(d) {
    return (d.getMonth() + 1) + "월 " + d.getDate() + "일";
  }

  /* ---------- detail ---------- */
  function renderDetail(app, dayNum) {
    var d = DATA.days.filter(function (x) { return x.day === dayNum; })[0];
    if (!d) { go("#/"); return; }
    if (!isUnlocked(dayNum)) { toast("아직 잠긴 미션입니다."); go("#/"); return; }

    var p = state.progress[dayNum] || {};

    var nav = el("div", "detail-nav");
    var back = el("button", "btn ghost", "← 목록");
    back.addEventListener("click", function () { go("#/"); });
    nav.appendChild(back);
    nav.appendChild(el("span", "status-chip " + (p.done ? "done" : "open"), p.done ? "완료" : d.day + "일 차"));
    app.appendChild(nav);

    var card = el("div", "card");
    card.appendChild(el("div", "eyebrow", d.day + "일 차 미션"));
    card.appendChild(el("h2", null, d.title));

    var goal = el("div", "goal-box");
    goal.appendChild(el("div", "k", "목표"));
    goal.appendChild(el("div", "v", d.goal));
    goal.appendChild(el("div", "k", "결과물"));
    goal.appendChild(el("div", "v", d.result));
    card.appendChild(goal);

    card.appendChild(el("strong", null, "진행 단계"));
    var ol = el("ol", "steps");
    d.steps.forEach(function (s) { ol.appendChild(el("li", null, s)); });
    card.appendChild(ol);

    if (d.links && d.links.length) {
      var lr = el("div", "link-row");
      d.links.forEach(function (lnk) {
        var a = el("a", null, "🔗 " + lnk.label);
        a.href = lnk.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        lr.appendChild(a);
      });
      card.appendChild(lr);
    }
    app.appendChild(card);

    /* proof + submit */
    var proofCard = el("div", "card");
    proofCard.appendChild(el("strong", null, "미션 인증"));
    var area = el("div", "proof-area" + (p.proof ? " has-image" : ""));
    if (p.proof) {
      var img = el("img", "proof-preview");
      img.src = p.proof;
      img.alt = "인증샷 미리보기";
      area.appendChild(img);
    }
    area.appendChild(el("div", "proof-hint", d.proofHint || "인증샷을 업로드해주세요."));

    var fileInput = el("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.className = "hidden";
    fileInput.addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        state.progress[dayNum] = Object.assign({}, state.progress[dayNum], { proof: reader.result });
        save(state);
        render();
      };
      reader.readAsDataURL(file);
    });

    var pick = el("button", "btn secondary", p.proof ? "인증샷 다시 선택" : "인증샷 업로드");
    pick.addEventListener("click", function () { fileInput.click(); });
    area.appendChild(pick);
    area.appendChild(fileInput);
    proofCard.appendChild(area);

    if (p.done) {
      var banner = el("div", "submitted-banner");
      banner.appendChild(document.createTextNode("✓ 제출 완료"));
      if (p.submittedAt) {
        banner.appendChild(el("span", null, " · " + new Date(p.submittedAt).toLocaleString("ko-KR")));
      }
      proofCard.appendChild(banner);

      var admin = el("div", "admin-comment");
      admin.appendChild(el("div", "who", "운영자"));
      admin.appendChild(el("div", null, "인증 확인했습니다. 꾸준함이 멋져요. 내일도 이어가봐요! 🙌"));
      proofCard.appendChild(admin);

      var undo = el("button", "btn ghost", "제출 취소");
      undo.addEventListener("click", function () {
        state.progress[dayNum] = Object.assign({}, state.progress[dayNum], { done: false, submittedAt: null });
        save(state);
        render();
      });
      proofCard.appendChild(undo);
    } else {
      var submit = el("button", "btn", "미션 제출하기");
      submit.disabled = !p.proof;
      if (!p.proof) submit.title = "먼저 인증샷을 업로드해주세요.";
      submit.addEventListener("click", function () {
        state.progress[dayNum] = Object.assign({}, state.progress[dayNum], {
          done: true,
          submittedAt: new Date().toISOString()
        });
        save(state);
        toast(dayNum + "일 차 미션을 완료했어요! 🎉");
        render();
      });
      proofCard.appendChild(submit);
    }
    app.appendChild(proofCard);
  }

  /* ---------- chrome ---------- */
  function updatePreviewBanner() {
    var b = $("#previewBanner");
    if (!b) return;
    b.classList.toggle("hidden", !state.previewMode);
  }

  function fillStaticChrome() {
    $("#brandTitle").textContent = DATA.title;
    $("#brandEyebrow").textContent = DATA.subtitle;
    $("#brandEdition").textContent = DATA.edition;
    var f = DATA.footer || {};
    $("#footerOrg").textContent = (f.org || "") + " | © " + (f.year || "") + " ";
    var mail = $("#footerMail");
    if (f.email) { mail.textContent = f.email; mail.href = "mailto:" + f.email; }
    document.title = DATA.title + " · " + DATA.subtitle;
  }

  /* ---------- boot ---------- */
  function boot() {
    fetch("./data/challenge.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("데이터를 불러오지 못했습니다 (" + r.status + ")");
        return r.json();
      })
      .then(function (data) {
        DATA = data;
        fillStaticChrome();
        updatePreviewBanner();
        render();
      })
      .catch(function (err) {
        $("#app").innerHTML = "";
        var c = el("div", "card");
        c.appendChild(el("h2", null, "불러오기 오류"));
        c.appendChild(el("p", "help-text", String(err.message || err)));
        $("#app").appendChild(c);
      });

    window.addEventListener("hashchange", function () { if (DATA) render(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

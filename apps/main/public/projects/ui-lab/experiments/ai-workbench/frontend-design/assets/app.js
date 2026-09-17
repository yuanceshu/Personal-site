(function () {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.documentElement.classList.add("has-js");
  window.requestAnimationFrame(() => document.body.classList.add("is-ready"));

  document.querySelectorAll("[data-exclusive]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest("button[aria-pressed]");
      if (!button) return;
      group.querySelectorAll("button[aria-pressed]").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });

      const valueTarget = group.dataset.valueTarget;
      if (valueTarget && button.dataset.value) {
        const output = document.querySelector(valueTarget);
        if (output) output.textContent = button.dataset.value;
      }
    });
  });

  const examples = {
    analytics: "医院管理人员希望统一查看门诊量、预约量和缴费金额。目前有 HIS、预约和缴费系统，可以每日导出汇总数据。希望按周查看趋势、发现异常，并用自然语言查询；暂不需要实时数据或患者明细。",
    retail: "商场顾客想按预算和购物偏好找到商品与店铺。已有商品目录、价格和店铺楼层数据，希望提供推荐理由和到店信息，第一版不做实时库存、支付或地图导航。",
    marketing: "营销人员希望根据历史活动复盘设计下一期活动。已有整理好的活动摘要，想选择活动目标、填写预算并生成可修改的方案草稿，由人员审核后执行，暂不连接广告平台。"
  };

  document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.querySelector("[data-main-input]");
      const key = button.dataset.example;
      if (input && examples[key]) {
        input.value = examples[key];
        input.dispatchEvent(new Event("input"));
        input.focus();
      }
    });
  });

  document.querySelectorAll("[data-count-for]").forEach((counter) => {
    const input = document.querySelector(counter.dataset.countFor);
    const update = () => {
      counter.textContent = `${input.value.length}/3000`;
    };
    if (input) {
      input.addEventListener("input", update);
      update();
    }
  });

  document.querySelectorAll("[data-next]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.href = button.dataset.next;
    });
  });

  document.querySelectorAll("[data-state-demo]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = document.querySelector("[data-feedback]");
      if (!panel) return;
      const state = button.dataset.stateDemo;
      panel.dataset.state = state;
      panel.classList.add("is-visible");
      const icon = panel.querySelector("[data-feedback-icon]");
      const title = panel.querySelector("[data-feedback-title]");
      const copy = panel.querySelector("[data-feedback-copy]");
      if (state === "loading") {
        icon.className = "spinner";
        icon.textContent = "";
        title.textContent = "正在梳理需求";
        copy.textContent = "理解目标 → 标记缺口";
      } else if (state === "error") {
        icon.className = "";
        icon.textContent = "!";
        title.textContent = "这次没有完成";
        copy.textContent = "输入仍然保留，可以重新梳理。";
      } else {
        icon.className = "";
        icon.textContent = "✓";
        title.textContent = "需求已整理";
        copy.textContent = "下一步可以确认理解。";
      }
    });
  });

  document.querySelectorAll("[data-scenario-select]").forEach((select) => {
    const action = document.querySelector("[data-result-link]");
    const update = () => {
      const pages = {
        analytics: "03-result-analytics.html",
        retail: "04-result-retail.html",
        marketing: "05-result-marketing.html"
      };
      if (action) action.href = pages[select.value] || pages.analytics;
    };
    select.addEventListener("change", update);
    update();
  });

  document.querySelectorAll("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector(button.dataset.scrollTarget)?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start"
      });
    });
  });

  document.querySelectorAll("[data-module-target]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-module-target]").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      document.querySelectorAll(".module.is-highlighted").forEach((item) => item.classList.remove("is-highlighted"));
      const module = document.querySelector(button.dataset.moduleTarget);
      if (module) {
        module.classList.add("is-highlighted");
        module.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
        window.setTimeout(() => module.classList.remove("is-highlighted"), 1800);
      }
    });
  });

  document.querySelectorAll("[data-period]").forEach((button) => {
    button.addEventListener("click", () => {
      const period = button.dataset.period;
      const weekly = period === "week";
      const values = weekly
        ? { visits: "12,450", appointments: "8,320", revenue: "326 万", change: "−8.2% 较前一周", anomaly: "周三 · 1,600 人次" }
        : { visits: "13,562", appointments: "8,030", revenue: "333 万", change: "+2.7% 较前一周", anomaly: "周三 · 1,820 人次" };
      Object.entries(values).forEach(([key, value]) => {
        const item = document.querySelector(`[data-metric-value="${key}"]`);
        if (item) item.textContent = value;
      });
      const periodLabel = document.querySelector("[data-period-label]");
      if (periodLabel) periodLabel.textContent = weekly ? "本周" : "上周";
    });
  });

  const budget = document.querySelector("[data-budget]");
  const budgetValue = document.querySelector("[data-budget-value]");
  if (budget && budgetValue) {
    budget.addEventListener("input", () => {
      budgetValue.textContent = `¥ ${Number(budget.value).toLocaleString("zh-CN")}`;
    });
  }

  document.querySelectorAll("[data-store]").forEach((button) => {
    button.addEventListener("click", () => {
      const route = document.querySelector("[data-store-route]");
      if (!route) return;
      route.querySelector("[data-route-store]").textContent = button.dataset.store;
      route.querySelector("[data-route-floor]").textContent = button.dataset.floor;
      route.querySelector("[data-route-detail]").textContent = button.dataset.detail;
      route.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    });
  });
})();

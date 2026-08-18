import { saveManager } from "../saveManager.js";
import { SDK } from "../sdk.js";
import { audio } from "../audio.js";
import { createButton } from "../ui.js";
import { LEADERBOARD_NAME } from "../config.js";
import { t } from "../i18n.js";

export class LeaderboardScene extends Phaser.Scene {
  constructor() { super("LeaderboardScene"); }
  init(data) { this.returnTo = data?.returnTo || "MenuScene"; }

  async create() {
    audio.ensure();
    this.cameras.main.setBackgroundColor("#151528");
    this.add.rectangle(270, 480, 540, 960, 0x1a1a2e);

    this.add.text(270, 40, t("lb_title"), {
      fontFamily: "Arial", fontSize: "28px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(270, 75, t("lb_subtitle"), {
      fontFamily: "Arial", fontSize: "13px", color: "#8899bb",
    }).setOrigin(0.5);

    const myScore = saveManager.data.stats?.maxWave || 0;
    this.add.text(270, 105, t("lb_your_record", myScore), {
      fontFamily: "Arial", fontSize: "16px", color: "#57ffb8", fontStyle: "bold",
    }).setOrigin(0.5);

    createButton(this, 270, 140, 260, 38, t("lb_submit"),
      async () => await this.submitAndRefresh(),
      { color: 0x3b2d5e, hoverColor: 0x5a40a0, stroke: 0xb388ff, textSize: "14px" });

    this.statusText = this.add.text(270, 180, t("lb_loading"), {
      fontFamily: "Arial", fontSize: "13px", color: "#aabbcc",
    }).setOrigin(0.5);

    this.listY = 210;
    this.entriesContainer = this.add.container(0, 0);

    createButton(this, 270, 895, 200, 50, t("common_back"),
      () => this.scene.start(this.returnTo),
      { textSize: "18px" });

    await this.loadLeaderboard();
  }

  async submitAndRefresh() {
    const myScore = saveManager.data.stats?.maxWave || 0;
    this.statusText.setText(t("lb_sending"));
    await SDK.submitScore(LEADERBOARD_NAME, myScore);
    await this.loadLeaderboard();
  }

  async loadLeaderboard() {
    this.entriesContainer.removeAll(true);
    this.statusText.setText(t("lb_loading"));

    const myScore = saveManager.data.stats?.maxWave || 0;
    if (myScore > 0) {
      try { await SDK.submitScore(LEADERBOARD_NAME, myScore); } catch (e) {}
    }

    const result = await SDK.getLeaderboard(LEADERBOARD_NAME, 10);

    if (result.source === "local") {
      this.statusText.setText(t("lb_source_local"));
      this.statusText.setColor("#ffaa88");
    } else {
      this.statusText.setText(t("lb_source_yandex"));
      this.statusText.setColor("#57ffb8");
    }

    this.renderEntries(result.entries, result.player);
  }

  renderEntries(entries, player) {
    let y = this.listY;
    const rowH = 54, gap = 4;
    const cx = 270, w = 490;

    if (entries.length === 0) {
      this.entriesContainer.add(this.add.text(270, y + 40, t("lb_empty"), {
        fontFamily: "Arial", fontSize: "16px", color: "#8899bb", align: "center",
      }).setOrigin(0.5));
      return;
    }

    const myId = localStorage.getItem("dk_guest_id");

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const isMe = (player && e.rank === player.rank) || (myId && e.uniqueID === myId);
      const isTop3 = e.rank <= 3;

      const bgColor = isMe ? 0x2b5c3c : isTop3 ? 0x3a3a1a : 0x24244a;
      const borderColor = isMe ? 0x7effa7 : isTop3 ? 0xffd700 : 0x444466;

      const bg = this.add.rectangle(cx, y + rowH / 2, w, rowH, bgColor).setStrokeStyle(2, borderColor);
      this.entriesContainer.add(bg);

      let rankIcon;
      if (e.rank === 1) rankIcon = "🥇";
      else if (e.rank === 2) rankIcon = "🥈";
      else if (e.rank === 3) rankIcon = "🥉";
      else rankIcon = `#${e.rank}`;

      const rank = this.add.text(cx - w / 2 + 30, y + rowH / 2, rankIcon, {
        fontFamily: "Arial", fontSize: isTop3 ? "22px" : "16px",
        color: isTop3 ? "#ffd700" : "#ffffff", fontStyle: "bold",
      }).setOrigin(0.5);
      this.entriesContainer.add(rank);

      const name = this.add.text(cx - w / 2 + 70, y + rowH / 2, e.name || t("lb_player_default"), {
        fontFamily: "Arial", fontSize: "16px",
        color: isMe ? "#7effa7" : "#ffffff", fontStyle: "bold",
      }).setOrigin(0, 0.5);
      this.entriesContainer.add(name);

      const score = this.add.text(cx + w / 2 - 15, y + rowH / 2, t("lb_wave", e.score), {
        fontFamily: "Arial", fontSize: "15px",
        color: isMe ? "#7effa7" : "#ffd700", fontStyle: "bold",
      }).setOrigin(1, 0.5);
      this.entriesContainer.add(score);

      if (isMe) {
        const you = this.add.text(cx - w / 2 + 5, y + 5, t("lb_you"), {
          fontFamily: "Arial", fontSize: "10px", color: "#7effa7", fontStyle: "bold",
        }).setOrigin(0);
        this.entriesContainer.add(you);
      }

      y += rowH + gap;
    }

    if (player && !entries.find(e => e.rank === player.rank)) {
      y += 12;
      this.entriesContainer.add(this.add.text(cx, y, "···", {
        fontFamily: "Arial", fontSize: "20px", color: "#666677",
      }).setOrigin(0.5));
      y += 24;

      const bg = this.add.rectangle(cx, y + rowH / 2, w, rowH, 0x2b5c3c).setStrokeStyle(2, 0x7effa7);
      this.entriesContainer.add(bg);
      const rank = this.add.text(cx - w / 2 + 30, y + rowH / 2, `#${player.rank}`, {
        fontFamily: "Arial", fontSize: "16px", color: "#7effa7", fontStyle: "bold",
      }).setOrigin(0.5);
      const name = this.add.text(cx - w / 2 + 70, y + rowH / 2, player.name || t("lb_you"), {
        fontFamily: "Arial", fontSize: "16px", color: "#7effa7", fontStyle: "bold",
      }).setOrigin(0, 0.5);
      const score = this.add.text(cx + w / 2 - 15, y + rowH / 2, t("lb_wave", player.score), {
        fontFamily: "Arial", fontSize: "15px", color: "#7effa7", fontStyle: "bold",
      }).setOrigin(1, 0.5);
      this.entriesContainer.add([rank, name, score]);
    }
  }

  pauseForAd() {}
  resumeAfterAd() {}
}
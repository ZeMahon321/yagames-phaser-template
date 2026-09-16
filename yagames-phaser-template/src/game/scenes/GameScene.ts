import { SceneName } from "./Scenes"
import { SndMng } from "@/sound/SndMng"
import { Config } from "@/data/Config";
import { MyButton } from "../gui/MyButton";
import { GameData, UnitType, EnemyType } from "@/data/GameData";
import { Params } from "@/data/Params";
import { FrontEvents } from "../events/FrontEvents";
import { YaGamesApi } from "@/api/YaGamesApi";
import { DeviceInfo } from "@/utils/DeviceInfo";
import { AdMng } from "../mng/AdMng";
import { AdShower, AdShowerEvent } from "../gui/AdShower";

const CURT_DUR = 750;
const UNIT_COST = 100;

export default class GameScene extends Phaser.Scene {
    private _dummy: Phaser.GameObjects.Container;
    private _bg: Phaser.GameObjects.Image;
    private _coinsText: Phaser.GameObjects.Text;
    private _unitsText: Phaser.GameObjects.Text;
    private _heroText: Phaser.GameObjects.Text;
    private _waveText: Phaser.GameObjects.Text;
    private blackCurtain: Phaser.GameObjects.Graphics;
    private _adShower: AdShower;
    private _isTransit = false;

    private _btnBuyWarrior: MyButton;
    private _btnBuyArcher: MyButton;
    private _btnDamage: MyButton;
    private _btnHealth: MyButton;
    private _btnMergeWarrior: MyButton;
    private _btnMergeArcher: MyButton;
    private _btnStartWave: MyButton;
    private _btnReset: MyButton;

    // текстовые подписи к кнопкам
    private _btnLabels: Phaser.GameObjects.Text[] = [];

    private _enemiesContainer: Phaser.GameObjects.Container;
    private _enemySprites: Phaser.GameObjects.Graphics[] = [];
    private _enemyTexts: Phaser.GameObjects.Text[] = [];
    private _heroSprite: Phaser.GameObjects.Graphics;
    private _heroHpBar: Phaser.GameObjects.Graphics;
    private _heroHpText: Phaser.GameObjects.Text;
    private _alliesContainer: Phaser.GameObjects.Container;

    // таймер автосохранения
    private _saveTimer = 0;
    private readonly _saveInterval = 5.0;

    // таймер боя
    private _combatTimer = 0;
    private readonly _combatInterval = 1.0;

    // таймер контратаки врагов
    private _counterAttackTimer = 0;
    private readonly _counterAttackInterval = 1.0;

    constructor() {
        super(SceneName.Game);
    }

    create() {
        this._isTransit = true;
        SndMng.scene = this;
        this.cameras.main.centerOn(0, 0);

        GameData.getInstance().load();

        this._dummy = this.add.container();

        // фон
        this._bg = new Phaser.GameObjects.Image(this, 0, 0, 'game', 'bg');
        this._bg.scale = (Config.GH + 170) / this._bg.height;
        this._dummy.add(this._bg);

        // === HUD (верхняя панель) ===
        const hudY = -Config.GH_HALF + 50;

        // Монеты
        this._coinsText = new Phaser.GameObjects.Text(this, 0, hudY,
            '', { font: "44px Ubuntu", align: 'center' })
            .setOrigin(0.5)
            .setColor('#ffd700');
        this._coinsText.setStroke('#111111', 6);
        this._dummy.add(this._coinsText);

        // Волна
        this._waveText = new Phaser.GameObjects.Text(this, 0, hudY + 55,
            '', { font: "32px Ubuntu", align: 'center' })
            .setOrigin(0.5)
            .setColor('#ff6666');
        this._waveText.setStroke('#111111', 4);
        this._dummy.add(this._waveText);

        // Юниты
        this._unitsText = new Phaser.GameObjects.Text(this, 0, hudY + 100,
            '', { font: "26px Ubuntu", align: 'center' })
            .setOrigin(0.5)
            .setColor('#dddddd');
        this._unitsText.setStroke('#111111', 3);
        this._dummy.add(this._unitsText);

        // === Поле боя ===
        // Контейнер союзников (герой + юниты)
        this._alliesContainer = this.add.container(-800, 0);
        this._dummy.add(this._alliesContainer);

        // Герой
        this._heroSprite = this.add.graphics();
        this._alliesContainer.add(this._heroSprite);

        // HP бар героя
        this._heroHpBar = this.add.graphics();
        this._alliesContainer.add(this._heroHpBar);

        // HP текст над героем
        this._heroHpText = new Phaser.GameObjects.Text(this, -800, Config.GH_HALF - 220,
            '', { font: "24px Ubuntu", align: 'center' })
            .setOrigin(0.5)
            .setColor('#33ff33');
        this._heroHpText.setStroke('#000000', 4);
        this._dummy.add(this._heroHpText);

        // Контейнер врагов
        this._enemiesContainer = this.add.container(800, 0);
        this._dummy.add(this._enemiesContainer);

        // === Кнопки с подписями ===
        const btnY = Config.GH_HALF - 80;
        const sc = Math.min(1.0, Params.gameWidth / 500);
        const labelSc = Math.min(0.7, Params.gameWidth / 700);

        // Покупка юнитов
        this._btnBuyWarrior = new MyButton(this, -200, btnY, 'game', 'Button_016', sc);
        this._btnBuyWarrior.on('click', () => this.onBuyUnit(UnitType.Warrior), this);
        this._dummy.add(this._btnBuyWarrior);
        this._btnLabels.push(this.add.text(-200, btnY + 75, '⚔️ Воин\n100💰', { font: "22px Ubuntu", align: 'center', color: '#ffffff' }).setOrigin(0.5).setStroke('#000000', 3).setScale(labelSc));
        this._dummy.add(this._btnLabels[this._btnLabels.length - 1]);

        this._btnBuyArcher = new MyButton(this, 200, btnY, 'game', 'Button_016', sc);
        this._btnBuyArcher.on('click', () => this.onBuyUnit(UnitType.Archer), this);
        this._dummy.add(this._btnBuyArcher);
        this._btnLabels.push(this.add.text(200, btnY + 75, '🏹 Лучник\n100💰', { font: "22px Ubuntu", align: 'center', color: '#ffffff' }).setOrigin(0.5).setStroke('#000000', 3).setScale(labelSc));
        this._dummy.add(this._btnLabels[this._btnLabels.length - 1]);

        // Прокачка героя
        const midY = btnY - 110;
        this._btnDamage = new MyButton(this, -200, midY, 'game', 'Button_024', sc * 0.85);
        this._btnDamage.on('click', this.onUpgradeDamage, this);
        this._dummy.add(this._btnDamage);
        this._btnLabels.push(this.add.text(-200, midY + 60, '⚔️ Урон героя', { font: "22px Ubuntu", align: 'center', color: '#ffffff' }).setOrigin(0.5).setStroke('#000000', 3).setScale(labelSc));
        this._dummy.add(this._btnLabels[this._btnLabels.length - 1]);

        this._btnHealth = new MyButton(this, 200, midY, 'game', 'Button_016', sc * 0.85);
        this._btnHealth.on('click', this.onUpgradeHealth, this);
        this._dummy.add(this._btnHealth);
        this._btnLabels.push(this.add.text(200, midY + 60, '❤️ HP героя', { font: "22px Ubuntu", align: 'center', color: '#ffffff' }).setOrigin(0.5).setStroke('#000000', 3).setScale(labelSc));
        this._dummy.add(this._btnLabels[this._btnLabels.length - 1]);

        // Слияние юнитов
        const mergeY = btnY - 220;
        this._btnMergeWarrior = new MyButton(this, -200, mergeY, 'game', 'Button_024', sc * 0.85);
        this._btnMergeWarrior.on('click', () => this.onMerge(UnitType.Warrior), this);
        this._dummy.add(this._btnMergeWarrior);
        this._btnLabels.push(this.add.text(-200, mergeY + 60, '🔀 5→1 Воин', { font: "22px Ubuntu", align: 'center', color: '#ffffff' }).setOrigin(0.5).setStroke('#000000', 3).setScale(labelSc));
        this._dummy.add(this._btnLabels[this._btnLabels.length - 1]);

        this._btnMergeArcher = new MyButton(this, 200, mergeY, 'game', 'Button_024', sc * 0.85);
        this._btnMergeArcher.on('click', () => this.onMerge(UnitType.Archer), this);
        this._dummy.add(this._btnMergeArcher);
        this._btnLabels.push(this.add.text(200, mergeY + 60, '🔀 5→1 Лучник', { font: "22px Ubuntu", align: 'center', color: '#ffffff' }).setOrigin(0.5).setStroke('#000000', 3).setScale(labelSc));
        this._dummy.add(this._btnLabels[this._btnLabels.length - 1]);

        // Начать волну
        this._btnStartWave = new MyButton(this, 0, btnY - 55, 'game', 'Button_016', sc * 1.1);
        this._btnStartWave.on('click', this.onStartWave, this);
        this._dummy.add(this._btnStartWave);
        this._btnLabels.push(this.add.text(0, btnY + 5, '⚔️ НАЧАТЬ ВОЛНУ', { font: "28px Ubuntu", align: 'center', color: '#ffcc00' }).setOrigin(0.5).setStroke('#000000', 4).setScale(labelSc * 1.2));
        this._dummy.add(this._btnLabels[this._btnLabels.length - 1]);

        // Сброс
        this._btnReset = new MyButton(this, 0, Config.GH_HALF - 30, 'game', 'Button_049', 0.4);
        this._btnReset.on('click', this.onReset, this);
        this._dummy.add(this._btnReset);

        // === Подписки на события ===
        GameData.getInstance().on('coinsChanged', this.updateCoins, this);
        GameData.getInstance().on('unitsChanged', this.updateUnits, this);
        GameData.getInstance().on('heroChanged', this.updateHero, this);
        GameData.getInstance().on('waveStarted', this.onWaveStarted, this);
        GameData.getInstance().on('enemiesChanged', this.updateEnemiesDisplay, this);
        GameData.getInstance().on('waveEnded', this.onWaveEnded, this);
        GameData.getInstance().on('waveLost', this.onWaveLost, this);

        // первичное обновление
        this.updateCoins();
        this.updateUnits();
        this.updateHero();
        this.updateWaveText();

        // черный занавес
        this.blackCurtain = this.add.graphics();
        this.blackCurtain.fillStyle(0x111111);
        this.blackCurtain.fillRect(-Config.GW_HALF, -Config.GH_HALF, Config.GW, Config.GH);
        this.hideBlackCurtain(() => {
            this._isTransit = false;
        });

        // реклама
        this._adShower = new AdShower(this, 0, 0);
        this._adShower.on(AdShowerEvent.onShow, this.onAdShow, this);
        this._adShower.visible = false;
        this.add.existing(this._adShower);

        FrontEvents.getInstance().addListener(FrontEvents.EVENT_WINDOW_RESIZE, this.onResize, this);

        YaGamesApi.getInstance().gameReady();

        window.addEventListener('beforeunload', () => {
            GameData.getInstance().save();
        });
    }

    // === Обновление UI ===
    private updateCoins() {
        this._coinsText.text = `💰 ${GameData.getInstance().getCoins()}`;
    }

    private updateUnits() {
        const d = GameData.getInstance();
        const maxUnits = d.getMaxUnits();
        const total = d.getTotalUnits();
        const wCount = d.getUnitCount(UnitType.Warrior, 1);
        const aCount = d.getUnitCount(UnitType.Archer, 1);
        
        this._unitsText.text = `Юниты: ${total}/${maxUnits}  ⚔️${wCount}  🏹${aCount}`;
    }

    private updateHero() {
        const d = GameData.getInstance();
        const curHp = d.getHeroCurrentHealth();
        const maxHp = d.getHeroHealth();
        
        // Текст HP над героем
        this._heroHpText.text = `${curHp}/${maxHp} ❤️`;
        this._heroHpText.setColor(curHp / maxHp > 0.3 ? '#33ff33' : '#ff3333');
        
        // Рисуем героя
        this._heroSprite.clear();
        // Тело героя (синий рыцарь)
        this._heroSprite.fillStyle(0x3366cc);
        this._heroSprite.fillRoundedRect(-825, Config.GH_HALF - 55, 50, 70, 8);
        // Шлем
        this._heroSprite.fillStyle(0x6699ff);
        this._heroSprite.fillRoundedRect(-820, Config.GH_HALF - 60, 40, 25, 6);
        // Меч
        this._heroSprite.fillStyle(0xcccccc);
        this._heroSprite.fillRect(-800, Config.GH_HALF - 40, 6, 40);
        
        // HP бар над героем
        this._heroHpBar.clear();
        const barX = -835;
        const barY = Config.GH_HALF - 75;
        const barW = 70;
        const barH = 10;
        this._heroHpBar.fillStyle(0x000000);
        this._heroHpBar.fillRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, 3);
        this._heroHpBar.fillStyle(curHp / maxHp > 0.3 ? 0x33cc33 : 0xcc3333);
        this._heroHpBar.fillRoundedRect(barX, barY, barW * (curHp / maxHp), barH, 2);
    }

    private updateWaveText() {
        const d = GameData.getInstance();
        this._waveText.text = `Волна ${d.getWave()} | Убито: ${d.getEnemiesKilled()}`;
    }

    // === Покупка юнита ===
    private onBuyUnit(type: UnitType) {
        if (this._isTransit) return;
        const gd = GameData.getInstance();
        if (gd.getTotalUnits() >= gd.getMaxUnits()) {
            console.log('Максимум юнитов!');
            return;
        }
        if (gd.spendCoins(UNIT_COST)) {
            gd.addUnit(type);
            gd.save();
        } else {
            console.log('Недостаточно монет');
        }
    }

    // === Прокачка героя ===
    private onUpgradeDamage() {
        if (this._isTransit) return;
        if (GameData.getInstance().upgradeDamage()) {
            GameData.getInstance().save();
            this.updateHero();
        }
    }

    private onUpgradeHealth() {
        if (this._isTransit) return;
        if (GameData.getInstance().upgradeHealth()) {
            GameData.getInstance().save();
            this.updateHero();
        }
    }

    // === Объединение юнитов ===
    private onMerge(type: UnitType) {
        if (this._isTransit) return;
        const gd = GameData.getInstance();
        if (gd.merge(type)) {
            gd.save();
        } else {
            console.log('Нечего объединять');
        }
    }

    // === Волна ===
    private onStartWave() {
        if (this._isTransit) return;
        const gd = GameData.getInstance();
        if (gd.isWaveActive()) return;
        gd.startWave();
    }

    private onWaveStarted() {
        this.updateWaveText();
        this.updateEnemiesDisplay();
    }

    private updateEnemiesDisplay() {
        const gd = GameData.getInstance();
        const enemies = gd.getEnemies();

        // Удаляем старые спрайты и тексты
        this._enemySprites.forEach(s => s.destroy());
        this._enemySprites = [];
        this._enemyTexts.forEach(t => t.destroy());
        this._enemyTexts = [];

        const startX = 800;
        const spacing = Math.min(90, 600 / Math.max(enemies.length, 1));
        
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const g = this.add.graphics();
            const x = startX + i * spacing;
            const y = 0;

            // цвет зависит от типа монстра
            let color: number;
            switch (e.type) {
                case 0 /* Goblin */: color = 0x44cc44; break;
                case 1 /* Skeleton */: color = 0xcccccc; break;
                case 2 /* Orc */: color = 0x884444; break;
                default: color = 0xcc3333;
            }
            g.fillStyle(color);
            g.fillRoundedRect(x - 18, y - 18, 36, 36, 6);

            const hpRatio = e.hp / e.maxHp;
            g.fillStyle(0x000000);
            g.fillRect(x - 22, y - 30, 44, 6);
            g.fillStyle(0x33cc33);
            g.fillRect(x - 22, y - 30, 44 * hpRatio, 6);

            this._enemiesContainer.add(g);
            this._enemySprites.push(g);

            // Текст HP над врагом
            const hpText = this.add.text(x, y - 40, `${e.hp}`, { font: "18px Ubuntu", color: '#ffffff' }).setOrigin(0.5).setStroke('#000000', 3);
            this._dummy.add(hpText);
            this._enemyTexts.push(hpText);
        }
    }

    private onWaveEnded(reward: number) {
        this.updateWaveText();
        this.updateEnemiesDisplay();
        console.log(`Волна пройдена! Награда: ${reward} монет`);
    }

    private onWaveLost() {
        this.updateWaveText();
        this.updateEnemiesDisplay();
        console.log('Волна проиграна — герой погиб!');
    }

    private onReset() {
        if (this._isTransit) return;
        if (confirm('Сбросить весь прогресс?')) {
            GameData.getInstance().reset();
            this.updateCoins();
            this.updateUnits();
            this.updateHero();
            this.updateWaveText();
        }
    }

    // === Бой ===
    private doCombatTick() {
        const gd = GameData.getInstance();
        const enemies = gd.getEnemies();
        if (enemies.length === 0) {
            gd.endWave();
            return;
        }

        // Атака героя и юнитов
        let totalDamage = gd.getHeroDamage();
        for (const unit of gd.units) {
            const stats = GameData.getUnitStats(unit.type, unit.level);
            totalDamage += stats.damage;
        }

        let dmgLeft = totalDamage;
        while (dmgLeft > 0 && gd.getEnemies().length > 0) {
            const target = gd.getEnemies()[0];
            if (target.hp <= dmgLeft) {
                dmgLeft -= target.hp;
                gd.damageEnemy(0, target.hp);
            } else {
                gd.damageEnemy(0, dmgLeft);
                dmgLeft = 0;
            }
        }

        // Контратака врагов
        this.doCounterAttack();
    }

    private doCounterAttack() {
        const gd = GameData.getInstance();
        const enemies = gd.getEnemies();
        if (enemies.length === 0) return;

        // Суммарный урон всех живых врагов
        let totalEnemyDamage = 0;
        for (const enemy of enemies) {
            totalEnemyDamage += enemy.damage;
        }

        // Герой получает урон
        const killed = gd.heroTakeDamage(totalEnemyDamage);
        if (killed) {
            gd.waveLost();
        }
    }

    // === Update ===
    update(_allTime: number, dtMs: number) {
        const dt = dtMs * 0.001;
        this._adShower.update(dt);

        // автосохранение
        this._saveTimer += dt;
        if (this._saveTimer >= this._saveInterval) {
            this._saveTimer -= this._saveInterval;
            GameData.getInstance().save();
        }

        // бой
        const gd = GameData.getInstance();
        if (gd.isWaveActive()) {
            this._combatTimer += dt;
            if (this._combatTimer >= this._combatInterval) {
                this._combatTimer -= this._combatInterval;
                this.doCombatTick();
            }
        }
    }

    shutdown() {
        GameData.getInstance().save();
    }

    // === Занавес ===
    private showBlackCurtain(cb?: Function, ctx?: any) {
        this.tweens.killTweensOf(this.blackCurtain);
        this.blackCurtain.alpha = 0;
        this.blackCurtain.visible = true;
        this.tweens.add({
            targets: this.blackCurtain,
            alpha: 1,
            duration: CURT_DUR,
            ease: Phaser.Math.Easing.Sine.InOut,
            onComplete: () => { if (cb) cb.call(ctx); }
        });
    }

    private hideBlackCurtain(cb?: Function, ctx?: any) {
        this.tweens.killTweensOf(this.blackCurtain);
        this.tweens.add({
            targets: this.blackCurtain,
            alpha: 0,
            duration: CURT_DUR,
            ease: Phaser.Math.Easing.Sine.InOut,
            onComplete: () => {
                this.blackCurtain.visible = false;
                if (cb) cb.call(ctx);
            }
        });
    }

    private onResize() {
        // зарезервировано
    }

    private onAdShow() {
        this._adShower.visible = false;
        AdMng.getInstance().showInterstitial(this.game, () => {}, () => {}, this);
    }
}
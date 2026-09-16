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
import { Ally, Enemy } from "@/data/Entities";

const CURT_DUR = 750;
const UNIT_COST = 100;
const HERO_START_X = -600;
const HERO_START_Y = 0;

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

    // Сущности на поле боя
    private _allies: Ally[] = [];
    private _enemies: Enemy[] = [];
    private _hero: Ally | null = null;

    // Клавиатура
    private _cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
    private _keyW: Phaser.Input.Keyboard.Key | null = null;
    private _keyA: Phaser.Input.Keyboard.Key | null = null;
    private _keyS: Phaser.Input.Keyboard.Key | null = null;
    private _keyD: Phaser.Input.Keyboard.Key | null = null;

    // таймер автосохранения
    private _saveTimer = 0;
    private readonly _saveInterval = 5.0;

    // таймер боя
    private _combatTimer = 0;
    private readonly _combatInterval = 1.0;

    // таймер контратаки врагов
    private _counterAttackTimer = 0;
    private readonly _counterAttackInterval = 1.0;

    // Состояние игры: pre-battle (покупки), battle (бой), post-battle (результат)
    private _gameState: 'pre-battle' | 'battle' | 'post-battle' = 'pre-battle';

    constructor() {
        super(SceneName.Game);
    }

    create() {
        this._isTransit = true;
        SndMng.scene = this;
        this.cameras.main.centerOn(0, 0);

        // Клавиатура
        const keyboard = this.input.keyboard!;
        this._cursors = keyboard.createCursorKeys();
        this._keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this._keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this._keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this._keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

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
        // Создаём героя
        const heroStats = { hp: 200, damage: 15 };
        this._hero = new Ally(UnitType.Warrior, 1, -600, 0, heroStats.hp, heroStats.damage);
        this._allies.push(this._hero);
        
        // HP бар героя (отдельный graphics)
        this._hero.hpBar = this.add.graphics();
        this._dummy.add(this._hero.hpBar);
        
        // HP текст над героем
        this._hero.hpText = this.add.text(-600, -80, '', { font: "20px Ubuntu", color: '#33ff33' })
            .setOrigin(0.5)
            .setStroke('#000000', 3);
        this._dummy.add(this._hero.hpText);
        
        // Графика героя
        this._hero.graphics = this.add.graphics();
        this._dummy.add(this._hero.graphics);

        // === Кнопки с подписями (уменьшенные) ===
        const btnY = Config.GH_HALF - 80;
        const sc = Math.min(0.5, Params.gameWidth / 1000);
        const labelSc = Math.min(1.4, Params.gameWidth / 350);

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
        GameData.getInstance().on('enemiesChanged', this.onWaveStarted, this);
        GameData.getInstance().on('waveEnded', this.onWaveEnded, this);
        GameData.getInstance().on('waveLost', this.onWaveLost, this);

        // первичное обновление
        this.updateCoins();
        this.updateUnits();
        this.updateHero();
        this.updateWaveText();
        this.updateButtonsState();

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
        if (!this._hero || !this._hero.graphics || !this._hero.hpBar || !this._hero.hpText) return;
        const d = GameData.getInstance();
        
        // Обновляем макс HP и урон героя
        this._hero.maxHp = d.getHeroHealth();
        this._hero.damage = d.getHeroDamage();
        
        // Текст HP над героем — читаем из сущности, не из GameData
        this._hero.hpText.text = `${Math.ceil(this._hero.currentHp)}/${this._hero.maxHp}`;
        this._hero.hpText.setColor(this._hero.getHpPercent() > 0.3 ? '#33ff33' : '#ff3333');
    }

    private updateWaveText() {
        const d = GameData.getInstance();
        this._waveText.text = `Волна ${d.getWave()}`;
    }

    /** Обновить состояние кнопок (вкл/выкл) */
    private updateButtonsState() {
        const inBattle = this._gameState !== 'pre-battle';
        
        this._btnBuyWarrior.setDisabled(inBattle);
        this._btnBuyArcher.setDisabled(inBattle);
        this._btnDamage.setDisabled(inBattle);
        this._btnHealth.setDisabled(inBattle);
        this._btnMergeWarrior.setDisabled(inBattle);
        this._btnMergeArcher.setDisabled(inBattle);
        this._btnStartWave.setDisabled(!inBattle);
    }

    // === Покупка юнита ===
    private onBuyUnit(type: UnitType) {
        if (this._isTransit || this._gameState !== 'pre-battle') return;
        const gd = GameData.getInstance();
        if (gd.getTotalUnits() >= gd.getMaxUnits()) {
            console.log('Максимум юнитов!');
            return;
        }
        if (gd.spendCoins(UNIT_COST)) {
            gd.addUnit(type);
            
            // Создаём визуального юнита
            const stats = GameData.getUnitStats(type, 1);
            const ally = new Ally(type, 1, -700, Math.random() * 200 - 100, stats.hp, stats.damage);
            ally.graphics = this.add.graphics();
            this._dummy.add(ally.graphics);
            ally.hpBar = this.add.graphics();
            this._dummy.add(ally.hpBar);
            ally.hpText = this.add.text(ally.x, ally.y - 40, '', { font: "14px Ubuntu", color: '#33ff33' })
                .setOrigin(0.5)
                .setStroke('#000000', 2);
            this._dummy.add(ally.hpText);
            this._allies.push(ally);
            
            gd.save();
        } else {
            console.log('Недостаточно монет');
        }
    }

    // === Прокачка героя ===
    private onUpgradeDamage() {
        if (this._isTransit || this._gameState !== 'pre-battle') return;
        if (GameData.getInstance().upgradeDamage()) {
            GameData.getInstance().save();
            this.updateHero();
        }
    }

    private onUpgradeHealth() {
        if (this._isTransit || this._gameState !== 'pre-battle') return;
        if (GameData.getInstance().upgradeHealth()) {
            GameData.getInstance().save();
            this.updateHero();
        }
    }

    // === Объединение юнитов ===
    private onMerge(type: UnitType) {
        if (this._isTransit || this._gameState !== 'pre-battle') return;
        const gd = GameData.getInstance();
        if (gd.merge(type)) {
            gd.save();
        } else {
            console.log('Нечего объединять');
        }
    }

    // === Волна ===
    private onStartWave() {
        if (this._isTransit || this._gameState !== 'pre-battle') return;
        const gd = GameData.getInstance();
        if (gd.isWaveActive()) return;
        
        this._gameState = 'battle';
        gd.startWave();
    }

    private onWaveStarted() {
        // Перестраиваем _allies из GameData — это исправляет рассинхронизацию
        // (юниты куплены, но графика уничтожена при смерти)
        const gd = GameData.getInstance();
        
        // Очищаем старую графику союзников
        for (const ally of this._allies) {
            if (ally.graphics) ally.graphics.destroy();
            if (ally.hpBar) ally.hpBar.destroy();
            if (ally.hpText) ally.hpText.destroy();
        }
        this._allies = [];
        
        // Создаём героя заново
        const heroStats = { hp: gd.getHeroHealth(), damage: gd.getHeroDamage() };
        this._hero = new Ally(UnitType.Warrior, 1, HERO_START_X, HERO_START_Y, heroStats.hp, heroStats.damage);
        this._hero.currentHp = heroStats.hp;
        this._allies.push(this._hero);
        
        this._hero.graphics = this.add.graphics();
        this._dummy.add(this._hero.graphics);
        this._hero.hpBar = this.add.graphics();
        this._dummy.add(this._hero.hpBar);
        this._hero.hpText = this.add.text(HERO_START_X, HERO_START_Y - 80, '', { font: "20px Ubuntu", color: '#33ff33' })
            .setOrigin(0.5)
            .setStroke('#000000', 3);
        this._dummy.add(this._hero.hpText);
        
        // Создаём юнитов из GameData
        for (const unitData of gd.units) {
            const stats = GameData.getUnitStats(unitData.type, unitData.level);
            const ally = new Ally(unitData.type, unitData.level, HERO_START_X, Math.random() * 200 - 100, stats.hp, stats.damage);
            ally.currentHp = stats.hp;
            this._allies.push(ally);
            
            ally.graphics = this.add.graphics();
            this._dummy.add(ally.graphics);
            ally.hpBar = this.add.graphics();
            this._dummy.add(ally.hpBar);
            ally.hpText = this.add.text(ally.x, ally.y - 40, '', { font: "14px Ubuntu", color: '#33ff33' })
                .setOrigin(0.5)
                .setStroke('#000000', 2);
            this._dummy.add(ally.hpText);
        }
        
        // Очищаем старых врагов
        this._enemies.forEach(e => {
            if (e.graphics) e.graphics.destroy();
            if (e.hpBar) e.hpBar.destroy();
            if (e.hpText) e.hpText.destroy();
        });
        this._enemies = [];
        
        // Создаём новых врагов как сущности
        const enemyData = gd.getEnemies();
        
        const startX = 600;
        const spacing = Math.min(80, 500 / Math.max(enemyData.length, 1));
        
        for (let i = 0; i < enemyData.length; i++) {
            const ed = enemyData[i];
            const enemy = new Enemy(ed.type, startX + i * spacing, 0, ed.maxHp, ed.damage);
            
            // Callback при смерти врага
            enemy.onDeath = (entity: Enemy) => {
                // Монеты за убийство
                gd.addCoins(ed.coinsDrop);
                // Увеличиваем счётчик убитых
                gd.incrementKills(1);
                // Удаляем визуальные объекты
                if (entity.graphics) entity.graphics.destroy();
                if (entity.hpBar) entity.hpBar.destroy();
                if (entity.hpText) entity.hpText.destroy();
            };
            
            // Графика
            enemy.graphics = this.add.graphics();
            this._dummy.add(enemy.graphics);
            
            // HP бар
            enemy.hpBar = this.add.graphics();
            this._dummy.add(enemy.hpBar);
            
            // HP текст
            enemy.hpText = this.add.text(startX + i * spacing, -60, '', { font: "16px Ubuntu", color: '#ffffff' })
                .setOrigin(0.5)
                .setStroke('#000000', 2);
            this._dummy.add(enemy.hpText);
            
            this._enemies.push(enemy);
        }
        
        this.updateWaveText();
    }

    private onWaveEnded(reward: number) {
        this.updateWaveText();
        console.log(`Волна пройдена! Награда: ${reward} монет`);
        
        // Восстанавливаем HP союзникам
        this._allies.forEach(ally => ally.heal(ally.getMaxHp()));
        if (this._hero) {
            GameData.getInstance().regenerateHeroHP();
        }
        
        // Автоматически возвращаемся в pre-battle
        this._gameState = 'pre-battle';
    }

    private onWaveLost() {
        this.updateWaveText();
        console.log('Волна проиграна — все союзники погибли!');
        
        // Автоматически возвращаемся в pre-battle
        this._gameState = 'pre-battle';
    }

    private onReset() {
        if (this._isTransit) return;
        if (confirm('Сбросить весь прогресс?')) {
            // Очищаем сущности
            this._allies.forEach(a => {
                if (a.graphics) a.graphics.destroy();
                if (a.hpBar) a.hpBar.destroy();
                if (a.hpText) a.hpText.destroy();
            });
            this._enemies.forEach(e => {
                if (e.graphics) e.graphics.destroy();
                if (e.hpBar) e.hpBar.destroy();
                if (e.hpText) e.hpText.destroy();
            });
            this._allies = [];
            this._enemies = [];
            this._hero = null;
            
            GameData.getInstance().reset();
            this.updateCoins();
            this.updateUnits();
            this.updateHero();
            this.updateWaveText();
        }
    }

    // === Бой (real-time) ===
    private updateEntities(dt: number) {
        const gd = GameData.getInstance();
        if (!gd.isWaveActive()) return;
        
        // Коллизия между союзниками
        for (let i = 0; i < this._allies.length; i++) {
            for (let j = i + 1; j < this._allies.length; j++) {
                this._allies[i].resolveCollision(this._allies[j]);
            }
        }
        
        // Коллизия между врагами
        for (let i = 0; i < this._enemies.length; i++) {
            for (let j = i + 1; j < this._enemies.length; j++) {
                this._enemies[i].resolveCollision(this._enemies[j]);
            }
        }
        
        // Коллизия герой-враги
        if (this._hero) {
            for (const enemy of this._enemies) {
                this._hero.resolveCollision(enemy);
            }
        }
        
        // Коллизия юниты-враги
        for (const ally of this._allies) {
            if (ally === this._hero) continue;
            for (const enemy of this._enemies) {
                ally.resolveCollision(enemy);
            }
        }
        
        // Обновляем союзников
        for (const ally of this._allies) {
            // Герой управляется только клавиатурой (НЕ движется к врагам)
            if (ally === this._hero && ally.isAlive()) {
                this.handleHeroInput(dt);
            }
            // Остальные юниты идут к ближайшему врагу (только если живы)
            if (ally !== this._hero && ally.isAlive()) {
                ally.update(dt, this._enemies, this);
            }
        }
        
        // Обновляем врагов
        for (const enemy of this._enemies) {
            enemy.update(dt, this._allies, this);
        }
        
        // Мёртвых юнитов НЕ удаляем из массива — они возродятся на следующей волне
        // Графику НЕ уничтожаем — она нужна для pre-battle отображения
        
        const aliveEnemies: Enemy[] = [];
        for (const enemy of this._enemies) {
            if (enemy.isAlive()) {
                aliveEnemies.push(enemy);
            } else {
                // Удаляем визуальные объекты мёртвого врага
                if (enemy.graphics) enemy.graphics.destroy();
                if (enemy.hpBar) enemy.hpBar.destroy();
                if (enemy.hpText) enemy.hpText.destroy();
            }
        }
        this._enemies = aliveEnemies;
        
        // Проверяем конец волны
        if (this._enemies.length === 0 && this._allies.length > 0) {
            gd.endWave();
        }
        
        // Проверяем поражение — только когда мёртвы ВСЕ союзники
        const anyAllyAlive = this._allies.some(a => a.isAlive());
        if (!anyAllyAlive) {
            gd.waveLost();
        }
    }
    
    /** Обработка ввода героя (WASD) — непрерывное движение и атака */
    private handleHeroInput(dt: number) {
        const speed = 200 * dt; // пикселей за секунду
        
        // Непрерывное движение при зажатой клавише
        if (this._keyW!.isDown) this._hero!.y -= speed;
        if (this._keyS!.isDown) this._hero!.y += speed;
        if (this._keyA!.isDown) this._hero!.x -= speed;
        if (this._keyD!.isDown) this._hero!.x += speed;
        
        // Границы поля — свободное движение по всему экрану
        this._hero!.x = Phaser.Math.Clamp(this._hero!.x, -Config.GW_HALF + 30, Config.GW_HALF - 30);
        this._hero!.y = Phaser.Math.Clamp(this._hero!.y, -Config.GH_HALF + 30, Config.GH_HALF - 30);
        
        // Атака героя — ищем ближайшего врага и бьём
        const gd = GameData.getInstance();
        const heroDamage = gd.getHeroDamage();
        this._hero!.damage = heroDamage;
        
        const target = this._hero!.findNearestTarget(this._enemies);
        if (target && target.isAlive()) {
            const dist = this._hero!.distanceTo(target);
            if (dist <= this._hero!.attackRange) {
                this._hero!._attackTimer += dt;
                if (this._hero!._attackTimer >= this._hero!._attackInterval) {
                    this._hero!._attackTimer = 0;
                    target.takeDamage(this._hero!.damage);
                    
                    if (target.currentHp <= 0 && target.onDeath) {
                        target.onDeath(target);
                    }
                }
            }
        }
    }
    
    /** Отрисовка всех сущностей */
    private renderEntities() {
        // Союзники
        for (const ally of this._allies) {
            // Позиционируем graphics
            if (ally.graphics) {
                ally.graphics.clear();
                ally.graphics.x = ally.x;
                ally.graphics.y = ally.y;
                ally.render(this);
            }
            
            // HP бар
            if (ally.hpBar) {
                ally.hpBar.clear();
                ally.hpBar.x = ally.x;
                ally.hpBar.y = ally.y;
                const barX = -20;
                const barY = -30;
                const barW = 40;
                const barH = 6;
                const hpPercent = ally.getHpPercent();
                
                ally.hpBar.fillStyle(0x000000);
                ally.hpBar.fillRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, 3);
                ally.hpBar.fillStyle(hpPercent > 0.3 ? 0x33cc33 : 0xcc3333);
                ally.hpBar.fillRoundedRect(barX, barY, barW * hpPercent, barH, 2);
            }
            
            // HP текст
            if (ally.hpText) {
                ally.hpText.setPosition(ally.x, ally.y - 40);
                ally.hpText.setText(`${Math.ceil(ally.currentHp)}/${ally.maxHp}`);
                ally.hpText.setColor(ally.getHpPercent() > 0.3 ? '#33ff33' : '#ff3333');
            }
        }
        
        // Враги
        for (const enemy of this._enemies) {
            // Позиционируем graphics
            if (enemy.graphics) {
                enemy.graphics.clear();
                enemy.graphics.x = enemy.x;
                enemy.graphics.y = enemy.y;
                enemy.render(this);
            }
            
            // HP бар
            if (enemy.hpBar) {
                enemy.hpBar.clear();
                enemy.hpBar.x = enemy.x;
                enemy.hpBar.y = enemy.y;
                const barX = -20;
                const barY = -30;
                const barW = 40;
                const barH = 6;
                const hpPercent = enemy.getHpPercent();
                
                enemy.hpBar.fillStyle(0x000000);
                enemy.hpBar.fillRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, 3);
                enemy.hpBar.fillStyle(hpPercent > 0.3 ? 0x33cc33 : 0xcc3333);
                enemy.hpBar.fillRoundedRect(barX, barY, barW * hpPercent, barH, 2);
            }
            
            // HP текст
            if (enemy.hpText) {
                enemy.hpText.setPosition(enemy.x, enemy.y - 40);
                enemy.hpText.setText(`${Math.ceil(enemy.currentHp)}`);
            }
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

        // real-time бой
        this.updateEntities(dt);
        
        // Отрисовка
        this.renderEntities();
        
        // Отрисовка сущностей в pre-battle режиме (стоят на месте)
        if (this._gameState === 'pre-battle') {
            this.renderPreBattleEntities();
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

    /** Отрисовка сущностей в pre-battle режиме (стоят на месте) */
    private renderPreBattleEntities() {
        const gd = GameData.getInstance();
        
        // Обновляем позицию героя (слева)
        if (this._hero) {
            this._hero.x = HERO_START_X;
            this._hero.y = HERO_START_Y;
            this._hero.currentHp = gd.getHeroCurrentHealth();
            this._hero.maxHp = gd.getHeroHealth();
            this._hero.damage = gd.getHeroDamage();
            this.renderSingleAlly(this._hero);
        }
        
        // Позиционируем всех юнитов в колонку слева
        let unitIndex = 0;
        for (const ally of this._allies) {
            if (ally === this._hero) continue;
            
            const spacingY = 30;
            const startY = -((gd.units.length - 1) * spacingY) / 2;
            ally.x = HERO_START_X - 100;
            ally.y = startY + unitIndex * spacingY;
            
            // Восстанавливаем HP из статов (в pre-battle HP всегда полный)
            const stats = GameData.getUnitStats(ally.type, ally.level);
            ally.currentHp = stats.hp;
            ally.maxHp = stats.hp;
            ally.damage = stats.damage;
            
            // Если нет графики — создаём
            if (!ally.graphics) {
                ally.graphics = this.add.graphics();
                this._dummy.add(ally.graphics);
            }
            if (!ally.hpBar) {
                ally.hpBar = this.add.graphics();
                this._dummy.add(ally.hpBar);
            }
            if (!ally.hpText) {
                ally.hpText = this.add.text(ally.x, ally.y - 40, '', { font: "14px Ubuntu", color: '#33ff33' })
                    .setOrigin(0.5)
                    .setStroke('#000000', 2);
                this._dummy.add(ally.hpText);
            }
            
            this.renderSingleAlly(ally);
            unitIndex++;
        }
    }

    /** Отрисовать одного союзника */
    private renderSingleAlly(ally: Ally) {
        if (!ally.graphics) return;
        
        // Позиционируем graphics
        ally.graphics.clear();
        ally.graphics.x = ally.x;
        ally.graphics.y = ally.y;
        ally.render(this);
        
        // HP бар
        if (ally.hpBar) {
            ally.hpBar.clear();
            ally.hpBar.x = ally.x;
            ally.hpBar.y = ally.y;
            const barX = -20;
            const barY = -30;
            const barW = 40;
            const barH = 6;
            const hpPercent = ally.getHpPercent();
            
            ally.hpBar.fillStyle(0x000000);
            ally.hpBar.fillRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, 3);
            ally.hpBar.fillStyle(hpPercent > 0.3 ? 0x33cc33 : 0xcc3333);
            ally.hpBar.fillRoundedRect(barX, barY, barW * hpPercent, barH, 2);
        }
        
        // HP текст
        if (ally.hpText) {
            ally.hpText.setPosition(ally.x, ally.y - 40);
            ally.hpText.setText(`${Math.ceil(ally.currentHp)}/${ally.maxHp}`);
            ally.hpText.setColor(ally.getHpPercent() > 0.3 ? '#33ff33' : '#ff3333');
        }
    }
}
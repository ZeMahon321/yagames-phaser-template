export enum UnitType {
    Warrior = 0,
    Archer = 1,
}

export enum EnemyType {
    Goblin = 0,
    Orc = 1,
    Skeleton = 2,
}

export interface UnitData {
    type: UnitType;
    level: number;
    currentHp: number; // HP для каждого юнита
}

export interface EnemyData {
    hp: number;
    maxHp: number;
    damage: number;
    type: EnemyType;
    coinsDrop: number;
}

export class GameData extends Phaser.Events.EventEmitter {

    private static instance: GameData = null;

    // === Игровые данные ===
    private _coins: number = 500;

    // Герой — сильнее на старте
    private _heroDamage: number = 15;
    private _heroHealth: number = 200;
    private _heroCurrentHealth: number = 200;
    private _heroDamageLevel: number = 1;
    private _heroHealthLevel: number = 1;

    // Юниты: массив всех юнитов {type, level}
    private _units: UnitData[] = [];

    // Волны и бой
    private _wave: number = 1;
    private _enemies: EnemyData[] = [];
    private _isWaveActive: boolean = false;
    private _enemiesKilled: number = 0;
    private _waveLost: boolean = false;

    private constructor() {
        super();
    }

    static getInstance(aLang?: string): GameData {
        if (!GameData.instance) {
            GameData.instance = new GameData();
        }
        return GameData.instance;
    }

    // === Монеты ===
    getCoins(): number {
        return this._coins;
    }

    addCoins(v: number) {
        this._coins += v;
        this.emit('coinsChanged', this._coins);
    }

    spendCoins(v: number): boolean {
        if (this._coins < v) return false;
        this._coins -= v;
        this.emit('coinsChanged', this._coins);
        return true;
    }

    // === Герой ===
    getHeroDamage(): number { return this._heroDamage; }
    getHeroHealth(): number { return this._heroHealth; }
    getHeroCurrentHealth(): number { return this._heroCurrentHealth; }
    getHeroDamageLevel(): number { return this._heroDamageLevel; }
    getHeroHealthLevel(): number { return this._heroHealthLevel; }

    getDamageUpgradeCost(): number {
        return Math.floor(50 * Math.pow(1.5, this._heroDamageLevel - 1));
    }

    getHealthUpgradeCost(): number {
        return Math.floor(50 * Math.pow(1.5, this._heroHealthLevel - 1));
    }

    upgradeDamage(): boolean {
        const cost = this.getDamageUpgradeCost();
        if (!this.spendCoins(cost)) return false;
        this._heroDamageLevel++;
        this._heroDamage = 15 + (this._heroDamageLevel - 1) * 5;
        this.emit('heroChanged');
        return true;
    }

    upgradeHealth(): boolean {
        const cost = this.getHealthUpgradeCost();
        if (!this.spendCoins(cost)) return false;
        this._heroHealthLevel++;
        this._heroHealth = 200 + (this._heroHealthLevel - 1) * 30;
        // восстанавливаем разницу в HP
        this._heroCurrentHealth = Math.min(
            this._heroCurrentHealth + 30,
            this._heroHealth
        );
        this.emit('heroChanged');
        return true;
    }

    /** Герой получает урон от врагов */
    heroTakeDamage(dmg: number): boolean {
        this._heroCurrentHealth -= dmg;
        if (this._heroCurrentHealth < 0) this._heroCurrentHealth = 0;
        this.emit('heroChanged');
        return this._heroCurrentHealth <= 0;
    }

    /** Восстановить HP героя между волнами */
    regenerateHeroHP() {
        this._heroCurrentHealth = this._heroHealth;
        this.emit('heroChanged');
    }

    /** Проверить, жив ли герой */
    isHeroAlive(): boolean {
        return this._heroCurrentHealth > 0;
    }

    // === Юниты ===
    get units(): UnitData[] { return this._units; }
    getUnitCount(type: UnitType, level: number): number {
        return this._units.filter(u => u.type === type && u.level === level).length;
    }

    getTotalUnits(): number {
        return this._units.length;
    }

    getMaxUnits(): number {
        return 20;
    }

    /** Тип юнита и его характеристики */
    static getUnitStats(type: UnitType, level: number): { damage: number; hp: number } {
        const base = type === UnitType.Warrior
            ? { damage: 5, hp: 30 }
            : { damage: 8, hp: 15 };
        return {
            damage: base.damage + (level - 1) * 3,
            hp: base.hp + (level - 1) * 15,
        };
    }

    addUnit(type: UnitType = UnitType.Warrior) {
        if (this._units.length >= this.getMaxUnits()) return;
        const stats = GameData.getUnitStats(type, 1);
        this._units.push({ type, level: 1, currentHp: stats.hp });
        this.emit('unitsChanged');
    }

    canMerge(type: UnitType): boolean {
        for (let lvl = 1; lvl <= 9; lvl++) {
            if (this.getUnitCount(type, lvl) >= 5) return true;
        }
        return false;
    }

    merge(type: UnitType): boolean {
        for (let lvl = 1; lvl <= 9; lvl++) {
            if (this.getUnitCount(type, lvl) >= 5) {
                // удаляем 5 юнитов уровня lvl
                let removed = 0;
                this._units = this._units.filter(u => {
                    if (u.type === type && u.level === lvl && removed < 5) {
                        removed++;
                        return false;
                    }
                    return true;
                });
                // добавляем 1 юнит уровня lvl+1
                const newStats = GameData.getUnitStats(type, lvl + 1);
                this._units.push({ type, level: lvl + 1, currentHp: newStats.hp });
                this.emit('unitsChanged');
                return true;
            }
        }
        return false;
    }

    // === Волны ===
    getWave(): number { return this._wave; }
    getEnemiesKilled(): number { return this._enemiesKilled; }
    isWaveActive(): boolean { return this._isWaveActive; }
    getEnemies() { return this._enemies; }
    
    /** Увеличить счётчик убитых */
    incrementKills(count: number = 1) {
        this._enemiesKilled += count;
    }

    startWave() {
        this._isWaveActive = true;
        this._enemies = [];

        // выбираем тип монстров в зависимости от волны
        const wave = this._wave;
        let enemyType: EnemyType;
        if (wave <= 3) enemyType = EnemyType.Goblin;
        else if (wave <= 7) enemyType = EnemyType.Skeleton;
        else enemyType = EnemyType.Orc;

        const count = 3 + Math.floor(wave / 2);
        const baseHp = 25 + wave * 12;
        const baseDmg = 3 + Math.floor(wave / 3);
        const baseCoins = 5 + wave * 2;

        for (let i = 0; i < count; i++) {
            this._enemies.push({
                hp: baseHp,
                maxHp: baseHp,
                damage: baseDmg,
                type: enemyType,
                coinsDrop: baseCoins + Math.floor(Math.random() * 5),
            });
        }
        this.emit('waveStarted');
    }

    damageEnemy(index: number, dmg: number) {
        const enemy = this._enemies[index];
        if (!enemy) return;
        enemy.hp -= dmg;
        if (enemy.hp <= 0) {
            this._enemies.splice(index, 1);
            this._enemiesKilled++;
            // монеты падают с каждого убитого монстра
            this.addCoins(enemy.coinsDrop);
        }
        this.emit('enemiesChanged');
    }

    endWave() {
        this._isWaveActive = false;
        // бонус за волну (небольшие)
        const reward = 10 + this._wave * 3;
        this.addCoins(reward);
        this._wave++;
        // восстанавливаем HP героя
        this.regenerateHeroHP();
        this.emit('waveEnded', reward);
    }

    /** Волна проиграна — герой погиб */
    waveLost() {
        this._isWaveActive = false;
        this._waveLost = true;
        this.regenerateHeroHP();
        this.emit('waveLost');
    }

    // === Сохранение ===
    save() {
        localStorage.setItem('idle_save', JSON.stringify({
            coins: this._coins,
            heroDamage: this._heroDamage,
            heroHealth: this._heroHealth,
            heroCurrentHealth: this._heroCurrentHealth,
            heroDamageLevel: this._heroDamageLevel,
            heroHealthLevel: this._heroHealthLevel,
            units: this._units,
            wave: this._wave,
            enemiesKilled: this._enemiesKilled,
        }));
    }

    load() {
        const raw = localStorage.getItem('idle_save');
        if (!raw) return;
        try {
            const data = JSON.parse(raw);
            this._coins = data.coins ?? 0;
            this._heroDamage = data.heroDamage ?? 15;
            this._heroHealth = data.heroHealth ?? 200;
            this._heroCurrentHealth = data.heroCurrentHealth ?? 200;
            this._heroDamageLevel = data.heroDamageLevel ?? 1;
            this._heroHealthLevel = data.heroHealthLevel ?? 1;
            this._units = data.units ?? [];
            this._wave = data.wave ?? 1;
            this._enemiesKilled = data.enemiesKilled ?? 0;
        } catch (e) {
            console.warn('Save load failed', e);
        }
    }

    /** Сбросить всё и начать заново */
    reset() {
        this._coins = 0;
        this._heroDamage = 15;
        this._heroHealth = 200;
        this._heroCurrentHealth = 200;
        this._heroDamageLevel = 1;
        this._heroHealthLevel = 1;
        this._units = [];
        this._wave = 1;
        this._enemiesKilled = 0;
        this._isWaveActive = false;
        this._enemies = [];
        this._waveLost = false;
        localStorage.removeItem('idle_save');
        this.emit('coinsChanged', 0);
        this.emit('heroChanged');
        this.emit('unitsChanged');
    }
}
import { UnitType } from "../data/GameData";

/** Базовый класс для всех существ на поле боя */
export abstract class Entity {
    /** Позиция на поле */
    x: number = 0;
    y: number = 0;
    
    /** Текущее и максимальное HP */
    currentHp: number = 100;
    maxHp: number = 100;
    
    /** Урон за тик */
    damage: number = 10;
    
    /** Дальность атаки (в пикселях) */
    attackRange: number = 50;
    
    /** Скорость движения */
    speed: number = 100; // пикселей в секунду
    
    /** Радиус коллизии */
    collisionRadius: number = 20;
    
    /** Текущая цель атаки */
    public _target: Entity | null = null;
    
    /** Таймер атаки */
    public _attackTimer: number = 0;
    public readonly _attackInterval: number = 1.0; // 1 секунда между атаками
    
    /** Визуальный объект (graphics) */
    graphics: Phaser.GameObjects.Graphics | null = null;
    
    /** HP бар (отдельный graphics) */
    hpBar: Phaser.GameObjects.Graphics | null = null;
    
    /** HP текст */
    hpText: Phaser.GameObjects.Text | null = null;
    
    /** Callback при смерти сущности */
    onDeath?: (entity: Entity) => void;
    
    constructor(x: number, y: number, maxHp: number, damage: number) {
        this.x = x;
        this.y = y;
        this.maxHp = maxHp;
        this.currentHp = maxHp;
        this.damage = damage;
    }
    
    /** Получить дистанцию до другой сущности */
    distanceTo(other: Entity): number {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /** Найти ближайшую цель среди врагов */
    findNearestTarget(enemies: Entity[]): Entity | null {
        if (enemies.length === 0) return null;
        
        let nearest: Entity | null = null;
        let nearestDist = Infinity;
        
        for (const enemy of enemies) {
            if (enemy.currentHp <= 0) continue;
            const dist = this.distanceTo(enemy);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        }
        
        return nearest;
    }
    
    /** Обновить логику (вызывается каждый кадр) */
    update(dt: number, enemies: Entity[], scene: Phaser.Scene) {
        if (this.currentHp <= 0) return;
        
        // Найти ближайшего врага
        const target = this.findNearestTarget(enemies);
        
        if (target && target.currentHp > 0) {
            const dist = this.distanceTo(target);
            
            if (dist <= this.attackRange) {
                // В зоне атаки — бьём
                this._attackTimer += dt;
                if (this._attackTimer >= this._attackInterval) {
                    this._attackTimer = 0;
                    target.takeDamage(this.damage);
                    
                    // Проверяем смерть цели
                    if (target.currentHp <= 0 && target.onDeath) {
                        target.onDeath(target);
                    }
                }
            } else {
                // Двигаться к цели
                const dx = target.x - this.x;
                const dy = target.y - this.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                
                if (len > 0) {
                    this.x += (dx / len) * this.speed * dt;
                    this.y += (dy / len) * this.speed * dt;
                }
            }
        }
    }
    
    /** Получить урон */
    getDamage(): number {
        return this.damage;
    }
    
    /** Получить HP */
    getHp(): number {
        return this.currentHp;
    }
    
    /** Получить макс HP */
    getMaxHp(): number {
        return this.maxHp;
    }
    
    /** Получить процент HP */
    getHpPercent(): number {
        return Math.max(0, this.currentHp / this.maxHp);
    }
    
    /** Получить урон */
    takeDamage(amount: number): void {
        this.currentHp -= amount;
        if (this.currentHp < 0) this.currentHp = 0;
    }
    
    /** Восстановить HP */
    heal(amount: number): void {
        this.currentHp += amount;
        if (this.currentHp > this.maxHp) this.currentHp = this.maxHp;
    }
    
    /** Проверить, жив ли */
    isAlive(): boolean {
        return this.currentHp > 0;
    }
    
    /** Разрешить коллизию между двумя сущностями */
    resolveCollision(other: Entity): void {
        const minDist = this.collisionRadius + other.collisionRadius;
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < minDist && dist > 0) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            const push = overlap / 2;
            
            this.x -= nx * push;
            this.y -= ny * push;
            other.x += nx * push;
            other.y += ny * push;
        }
    }
    
    /** Отрисовать */
    abstract render(scene: Phaser.Scene): void;
}

/** Союзник (герой или юнит) */
export class Ally extends Entity {
    type: UnitType;
    level: number;
    
    constructor(type: UnitType, level: number, x: number, y: number, maxHp: number, damage: number) {
        super(x, y, maxHp, damage);
        this.type = type;
        this.level = level;
        
        // Настройки в зависимости от типа
        if (type === UnitType.Warrior) {
            this.attackRange = 40; // Ближний бой
            this.speed = 80;
        } else {
            this.attackRange = 150; // Дальний бой
            this.speed = 60;
        }
    }
    
    render(scene: Phaser.Scene) {
        if (!this.graphics) return;
        
        this.graphics.clear();
        
        // Цвет в зависимости от типа
        let color: number;
        if (this.type === UnitType.Warrior) {
            color = 0x44cc44; // Зелёный для воина
        } else {
            color = 0xcccc44; // Жёлтый для лучника
        }
        
        // Тело (рисуем относительно 0,0 — graphics уже позиционирован)
        this.graphics.fillStyle(color);
        this.graphics.fillRoundedRect(-15, -15, 30, 30, 6);
        
        // Обводка по уровню
        this.graphics.lineStyle(2, 0xffffff);
        this.graphics.strokeRoundedRect(-15, -15, 30, 30, 6);
    }
}

/** Враг */
export class Enemy extends Entity {
    enemyType: number;
    
    constructor(enemyType: number, x: number, y: number, maxHp: number, damage: number) {
        super(x, y, maxHp, damage);
        this.enemyType = enemyType;
        
        // Настройки в зависимости от типа
        switch (enemyType) {
            case 0: // Goblin
                this.attackRange = 35;
                this.speed = 70;
                break;
            case 1: // Skeleton
                this.attackRange = 120;
                this.speed = 90;
                break;
            case 2: // Orc
                this.attackRange = 45;
                this.speed = 50;
                break;
            default:
                this.attackRange = 40;
                this.speed = 60;
        }
    }
    
    render(scene: Phaser.Scene) {
        if (!this.graphics) return;
        
        this.graphics.clear();
        
        // Цвет в зависимости от типа
        let color: number;
        switch (this.enemyType) {
            case 0: color = 0x44cc44; break; // Goblin - зелёный
            case 1: color = 0xcccccc; break; // Skeleton - серый
            case 2: color = 0x884444; break; // Orc - тёмно-красный
            default: color = 0xcc3333;
        }
        
        // Тело (рисуем относительно 0,0 — graphics уже позиционирован)
        this.graphics.fillStyle(color);
        this.graphics.fillRoundedRect(-18, -18, 36, 36, 6);
        
        // Обводка
        this.graphics.lineStyle(2, 0x000000);
        this.graphics.strokeRoundedRect(-18, -18, 36, 36, 6);
    }
}

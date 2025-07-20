export function getSkillName(skillId: number): string {
    try {
        return (
            document.highlite.gameLookups.Skills[skillId] || `Skill ${skillId}`
        );
    } catch {
        return `Skill ${skillId}`;
    }
}

export function getEquipmentTypeName(typeId: number): string {
    try {
        const types = ['helmet', 'chest', 'legs', 'shield', 'weapon', 'back', 'neck', 'gloves', 'boots', 'projectile'];
        return (
            types[typeId] ||
            `Type ${typeId}`
        );
    } catch {
        return `Type ${typeId}`;
    }
}

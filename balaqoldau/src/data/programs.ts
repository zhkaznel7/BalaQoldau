export const supportTypes = ['Мемлекеттік жәрдемақылар', 'Тегін үйірмелер', 'Білім беру гранттары', 'Әлеуметтік көмек'] as const;
export const familyCategories = ['Көпбалалы отбасы', 'Толық емес отбасы', 'Мүгедектігі бар бала тәрбиелейтін отбасы', 'Аз қамтылған отбасы', 'Басқа'];
export const regions = ['Алматы', 'Астана', 'Шымкент', 'Қарағанды', 'Ақтөбе', 'Түркістан облысы'];
export interface Program {
    id: string;
    title: string;
    type: typeof supportTypes[number];
    region: string;
    minAge: number;
    maxAge: number;
    categories: string[];
    description: string;
    eligibility: string[];
    documents: string[];
    instructions: string[];
    officialUrl: string | null;
    isDemo: boolean;
}
export interface SearchFilters {
    region: string;
    age: string;
    family: string;
    type: string;
    q?: string;
}
const examples = [
    ['creative', 'Шығармашылыққа алғашқы қадам', 1, 'Алматы', 6, 14, 0],
    ['learning', 'Білімге ашылған жол', 2, 'Астана', 12, 17, 3],
    ['family', 'Отбасына қолдау', 0, 'Алматы', 0, 17, 0],
    ['sport', 'Қозғалыс пен жаңа достар', 1, 'Шымкент', 7, 16, 4],
    ['care', 'Бірге өсу кеңістігі', 3, 'Қарағанды', 3, 17, 2],
    ['future', 'Жаңа мүмкіндік', 2, 'Ақтөбе', 10, 17, 1],
] as const;
export const programs: Program[] = examples.map(([id, title, type, region, minAge, maxAge, category]) => ({
    id, title, type: supportTypes[type], region, minAge, maxAge,
    categories: [...new Set([familyCategories[category], 'Басқа'])], isDemo: true, officialUrl: null,
    description: 'Бұл — платформаның жұмысын көрсету үшін жасалған ойдан шығарылған үлгі. Нақты бағдарлама, қаржыландыру немесе қолдау ұсынысы емес.',
    eligibility: [`Үлгі жас аралығы: ${minAge}–${maxAge} жас.`, `Үлгі өңірі: ${region}.`, 'Бұл өлшемдер тек іздеуді көрсетуге арналған, ресми талаптар емес.'],
    documents: ['Құжаттардың ресми тізімі әлі қосылмаған. Жеке құжаттарыңызды бұл платформаға жүктемеңіз.'],
    instructions: ['Бұл үлгіге өтінім берілмейді.', 'Тексерілген бағдарламалар қосылғанда, ресми талаптар мен өтінім сілтемесі осы жерде көрсетіледі.'],
}));
// Replace this repository with an API adapter backed by verified PostgreSQL records.
export const programRepository = {
    async search(filters: SearchFilters): Promise<Program[]> {
        return programs.filter(p => (!filters.region || p.region === filters.region)
            && (!filters.age || (Number(filters.age) >= p.minAge && Number(filters.age) <= p.maxAge))
            && (!filters.family || p.categories.includes(filters.family))
            && (!filters.type || p.type === filters.type)
            && (!filters.q?.trim() || `${p.title} ${p.type} ${p.region}`.toLocaleLowerCase('kk').includes(filters.q.trim().toLocaleLowerCase('kk'))));
    },
    getById(id: string) { return programs.find(p => p.id === id); },
};

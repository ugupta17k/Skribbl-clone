import { prisma } from '../lib/prisma';
import wordsData from '../words.json';

async function main() {
  for (const word of wordsData.words) {
    await prisma.word.upsert({
      where: { text: word },
      update: {},
      create: { text: word }
    });
  }
  console.log('words seeded!');
}

main()
  .catch((e) => console.log(e))
  .finally(() => prisma.$disconnect());
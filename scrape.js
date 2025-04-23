
const axios = require('axios');
const cheerio = require('cheerio');
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'pokemontcg';
const COLLECTION_NAME = 'cards';
const BASE_URL = 'https://asia.pokemon-card.com/th/card-search/detail';
const USD_TO_THB = 36;

function extractEnergyTypeFromImg(src) {
  return src ? src.split('/').pop().replace('.png', '') : 'Unknown';
}

function extractEvolutionSection($, selector) {
  return $(selector).find('a').map((_, el) => ({
    name: $(el).text().trim(),
    link: $(el).attr('href') || ''
  })).get();
}

async function scrapeCard(cardId) {
  const url = `${BASE_URL}/${cardId}/`;
  console.log(`🔍 กำลังดึงข้อมูลจาก: ${url}`);

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const rawName = $('h1.pageHeader.cardDetail').clone().children().remove().end().text().trim();
    const name = rawName || `Card ${cardId}`;
    const stage = $('.evolveMarker').text().trim() || 'Basic';
    const imageUrl = ($('.cardImage img').attr('src') || '').trim();
    const hp = $('span.hitPoint').next('span.number').text().trim() || '0';

    const typeImgTag = $('span.type').next('img');
    const pokemonType = extractEnergyTypeFromImg(typeImgTag.attr('src'));

    const weakImg = $('td.weakpoint img').attr('src');
    const resistImg = $('td.resist img').attr('src');

    const weaknessType = {
      type: extractEnergyTypeFromImg(weakImg),
      value: $('td.weakpoint').text().match(/[×xX]\d+/)?.[0] || '×2'
    };

    const resistanceType = resistImg
      ? {
          type: extractEnergyTypeFromImg(resistImg),
          value: $('td.resist').text().match(/-\d+/)?.[0] || '-30'
        }
      : {
          type: 'None',
          value: '0'
        };

    const retreat = $('td.escape img[src*="energy"]').length;

    const evolves = [
      ...extractEvolutionSection($, '.evolutionStep.first'),
      ...extractEvolutionSection($, '.evolutionStep.second'),
      ...extractEvolutionSection($, '.evolutionStep.third')
    ];

    const skills = [];
    $('.skill').each((_, el) => {
      const skillName = $(el).find('.skillName').text().trim() || '-';
      const skillCostImgs = $(el).find('.skillCost img').map((_, img) => {
        return extractEnergyTypeFromImg($(img).attr('src'));
      }).get();
      const skillDamage = $(el).find('.skillDamage').text().trim() || '0';
      const skillEffect = $(el).find('.skillEffect').text().trim() || '-';
      skills.push({ skillName, skillCost: skillCostImgs, skillDamage, skillEffect });
    });

    const baseUSD = +(Math.random() * 0.3 + 0.1).toFixed(3);
    const baseTHB = +(baseUSD * USD_TO_THB).toFixed(2);

    const priceHistory = Array.from({ length: 10 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (9 - i));
      return {
        date: d.toISOString().split('T')[0],
        price: +(baseTHB * (0.95 + Math.random() * 0.1)).toFixed(2)
      };
    });

    const currentPrice = priceHistory[priceHistory.length - 1].price;
    const averagePrice = +(
      priceHistory.reduce((sum, p) => sum + p.price, 0) / priceHistory.length
    ).toFixed(2);

    return {
      id: cardId,
      name,
      stage,
      imageUrl,
      hp,
      pokemonType,
      weaknessType,
      resistanceType,
      retreat,
      evolves,
      skills,
      currentPrice,
      averagePrice,
      priceHistory,
      url,
    };
  } catch (err) {
    console.error(`❌ ERROR at ${url}:`, err.message);
    return null;
  }
}

async function scrapeAllCards(start = 5184, end = 11223, batchSize = 5) {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  for (let batchStart = start; batchStart <= end; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize - 1, end);
    const cards = [];

    for (let id = batchStart; id <= batchEnd; id++) {
      const card = await scrapeCard(id);
      if (card) cards.push(card);
    }

    if (cards.length > 0) {
      await collection.insertMany(cards);
      console.log(`✅ บันทึกการ์ด ${batchStart} - ${batchEnd} (${cards.length} ใบ)`);
    }
  }

  await client.close();
  console.log(`🎉 เสร็จสิ้น: ดึงจาก ID ${start} ถึง ${end}`);
}

scrapeAllCards(); // เรียกใช้งานตรงนี้

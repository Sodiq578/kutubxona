require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

// Fayllardan ma'lumotlarni o'qib olish
const books = require("./books.json");
const ads = require("./ads.json");

// Konfiguratsiya
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_ID.split(",").map((id) => id.trim());
const CHANNEL_LINK = "https://t.me/KinolarTarjimaFantastikYangiKino";
const bot = new TelegramBot(TOKEN, { polling: true });

// Users faylini yaratish (agar mavjud bo'lmasa)
if (!fs.existsSync(path.join(__dirname, "users.json"))) {
  fs.writeFileSync(path.join(__dirname, "users.json"), JSON.stringify([], null, 2));
}

// Foydalanuvchilar ma'lumotlari
let users = require("./users.json");

// Vaqtincha ma'lumotlar
const waitingForBook = {};
const waitingForAd = {};
const activeAds = new Map();

// Til tanlash menyusi
const languageMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🇺🇿 O'zbekcha", callback_data: "uz" }],
      [{ text: "🇷🇺 Русский", callback_data: "ru" }],
      [{ text: "🇬🇧 English", callback_data: "en" }],
    ],
  },
};

// Asosiy menyu
function getMainMenu(lang) {
  return {
    reply_markup: {
      keyboard: [
        [lang === "uz" ? "📚 Kitob qidirish" : lang === "ru" ? "📚 Поиск книги" : "📚 Search book"],
        [lang === "uz" ? "📂 Barcha kitoblar" : lang === "ru" ? "📂 Все книги" : "📂 All books"],
        [lang === "uz" ? "⚙️ Sozlamalar" : lang === "ru" ? "⚙️ Настройки" : "⚙️ Settings"],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

// Orqaga menyusi
function getBackMenu(lang) {
  return {
    reply_markup: {
      keyboard: [
        [lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back"],
        [lang === "uz" ? "🏠 Asosiy menyu" : lang === "ru" ? "🏠 Главное меню" : "🏠 Main menu"],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

// Reklama boshqaruv menyusi
function getAdManagementMenu(lang, adId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === "uz" ? "✏️ Tahrirlash" : lang === "ru" ? "✏️ Редактировать" : "✏️ Edit", callback_data: `edit_ad_${adId}` }],
        [{ text: lang === "uz" ? "❌ O'chirish" : lang === "ru" ? "❌ Удалить" : "❌ Delete", callback_data: `delete_ad_${adId}` }],
        [{ text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", callback_data: "back_to_ads" }],
      ],
    },
  };
}

// Foydalanuvchilarni saqlash
function saveUsers() {
  fs.writeFileSync(path.join(__dirname, "users.json"), JSON.stringify(users, null, 2));
}

// Yangi foydalanuvchi qo'shish
function addUser(user) {
  const existingUser = users.find(u => u.id === user.id);
  if (!existingUser) {
    users.push({
      id: user.id,
      username: user.username || null,
      first_name: user.first_name,
      last_name: user.last_name || null,
      language: 'uz', // default til
      joined_at: new Date().toISOString(),
      last_active: new Date().toISOString()
    });
    saveUsers();
    return true;
  }
  return false;
}

// Foydalanuvchi tilini yangilash
function updateUserLanguage(userId, language) {
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].language = language;
    users[userIndex].last_active = new Date().toISOString();
    saveUsers();
    return true;
  }
  return false;
}

// Foydalanuvchi faolligini yangilash
function updateUserActivity(userId) {
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].last_active = new Date().toISOString();
    saveUsers();
    return true;
  }
  return false;
}

// Reklamalarni saqlash
function saveAds() {
  fs.writeFileSync(path.join(__dirname, "ads.json"), JSON.stringify(ads, null, 2));
}

// Reklamani tahrirlash
function editAd(adId, newData) {
  const index = ads.findIndex(ad => ad.id === adId);
  if (index !== -1) {
    ads[index] = { ...ads[index], ...newData };
    saveAds();
    
    if (activeAds.has(adId)) {
      const { timer } = activeAds.get(adId);
      clearTimeout(timer);
      const delay = (new Date(ads[index].schedule_time).getTime() - Date.now()) / 1000;
      broadcastAd(ads[index], delay > 0 ? delay : 0);
    }
    
    return true;
  }
  return false;
}

// Reklamani o'chirish
function deleteAd(adId) {
  const index = ads.findIndex(ad => ad.id === adId);
  if (index !== -1) {
    ads.splice(index, 1);
    saveAds();
    
    if (activeAds.has(adId)) {
      const { timer } = activeAds.get(adId);
      clearTimeout(timer);
      activeAds.delete(adId);
    }
    
    return true;
  }
  return false;
}

// Reklamalarni barcha foydalanuvchilarga yuborish
async function broadcastAd(ad, delaySeconds = 0) {
  const delayMs = delaySeconds * 1000;
  
  setTimeout(async () => {
    for (const user of users) {
      try {
        const lang = user.language || 'uz';
        
        if (ad.file_id) {
          const options = { 
            caption: ad.text,
            parse_mode: "Markdown",
            ...getAdManagementMenu(lang, ad.id)
          };
          
          if (ad.file_type === "photo") {
            await bot.sendPhoto(user.id, ad.file_id, options);
          } else if (ad.file_type === "video") {
            await bot.sendVideo(user.id, ad.file_id, options);
          } else if (ad.file_type === "document") {
            await bot.sendDocument(user.id, ad.file_id, options);
          }
        } else {
          await bot.sendMessage(
            user.id, 
            ad.text, 
            { 
              parse_mode: "Markdown",
              ...getAdManagementMenu(lang, ad.id)
            }
          );
        }
        
        // Foydalanuvchi faolligini yangilash
        updateUserActivity(user.id);
      } catch (error) {
        console.error(`Foydalanuvchiga reklama yuborishda xato: ${user.id}:`, error.message);
      }
    }
    
    activeAds.delete(ad.id);
  }, delayMs);
  
  activeAds.set(ad.id, {
    ad,
    timer: setTimeout(() => {}, delayMs)
  });
}

// Sana va vaqtni formatlash
function formatDate(dateStr, lang) {
  const date = new Date(dateStr);
  if (lang === "uz") {
    return date.toLocaleString("uz-UZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } else if (lang === "ru") {
    return date.toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } else {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
}

// Bot komandalari

// Start komandasi
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;

  // Yangi foydalanuvchini qo'shish
  const isNewUser = addUser({
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name
  });

  const lang = users.find(u => u.id === user.id)?.language || 'uz';

  if (isNewUser) {
    bot.sendMessage(chatId, 
      lang === "uz" 
        ? "Assalomu alaykum! Botimizga xush kelibsiz. Iltimos, tilni tanlang:" 
        : lang === "ru" 
        ? "Здравствуйте! Добро пожаловать в наш бот. Пожалуйста, выберите язык:" 
        : "Hello! Welcome to our bot. Please choose language:", 
      languageMenu
    );
  } else {
    bot.sendMessage(chatId, 
      lang === "uz" 
        ? "Tilni tanlang / Выберите язык / Choose language:" 
        : lang === "ru" 
        ? "Выберите язык / Choose language:" 
        : "Choose language:", 
      languageMenu
    );
  }
  updateUserActivity(user.id);
});

// Kontakt komandasi
bot.onText(/\/contact/, (msg) => {
  const chatId = msg.chat.id;
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';

  const contactMessage = lang === "uz" 
    ? "Adminlar bilan bog'lanish uchun:\n📞 Telefon: +998974634455\n📲 Telegram: https://t.me/Sadikov001"
    : lang === "ru" 
    ? "Для связи с администраторами:\n📞 Телефон: +998974634455\n📲 Telegram: https://t.me/Sadikov001"
    : "To contact the admins:\n📞 Phone: +998974634455\n📲 Telegram: https://t.me/Sadikov001";

  bot.sendMessage(chatId, contactMessage, getMainMenu(lang));
  updateUserActivity(msg.from.id);
});

// Reklama qo'shish komandasi
bot.onText(/\/addreklama/, (msg) => {
  const chatId = msg.chat.id;
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';
  
  if (!ADMIN_IDS.includes(msg.from.id.toString())) {
    bot.sendMessage(chatId, 
      lang === "uz" 
        ? "❌ Sizda bunday buyruqni bajarish huquqi yo'q." 
        : lang === "ru" 
        ? "❌ У вас нет прав выполнять эту команду." 
        : "❌ You don't have permission to execute this command.", 
      getMainMenu(lang)
    );
    return;
  }
  
  waitingForAd[chatId] = { step: "waiting_for_ad_content" };
  bot.sendMessage(
    chatId, 
    lang === "uz" 
      ? "📢 Reklama kontentini yuboring (matn, rasm, video yoki hujjat):\n\n" +
        "1. Agar reklamangiz matndan iborat bo'lsa, shunchaki matn yuboring\n" +
        "2. Agar reklamangiz rasmdan iborat bo'lsa, rasm yuboring\n" +
        "3. Agar reklamangiz videodan iborat bo'lsa, video yuboring\n" +
        "4. Agar reklamangiz fayldan iborat bo'lsa, fayl yuboring\n\n" +
        "❗ Eslatma: Agar media fayl (rasm/video/fayl) yuborsangiz, keyin matn yozishingiz kerak bo'ladi"
      : lang === "ru" 
      ? "📢 Отправьте контент рекламы (текст, изображение, видео или документ):\n\n" +
        "1. Если ваше объявление состоит из текста, просто отправьте текст\n" +
        "2. Если ваше объявление содержит изображение, отправьте изображение\n" +
        "3. Если ваше объявление содержит видео, отправьте видео\n" +
        "4. Если ваше объявление содержит файл, отправьте файл\n\n" +
        "❗ Примечание: Если вы отправляете медиафайл (изображение/видео/файл), вам нужно будет добавить текст позже"
      : "📢 Send the ad content (text, photo, video or document):\n\n" +
        "1. If your ad is text only, just send the text\n" +
        "2. If your ad contains an image, send the photo\n" +
        "3. If your ad contains a video, send the video\n" +
        "4. If your ad contains a file, send the document\n\n" +
        "❗ Note: If you send a media file (photo/video/document), you'll need to add text afterwards",
    getBackMenu(lang)
  );
  updateUserActivity(msg.from.id);
});

// Reklamalarni ko'rish komandasi
bot.onText(/\/listads/, (msg) => {
  const chatId = msg.chat.id;
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';
  
  if (!ADMIN_IDS.includes(msg.from.id.toString())) {
    bot.sendMessage(chatId, 
      lang === "uz" 
        ? "❌ Sizda bunday buyruqni bajarish huquqi yo'q." 
        : lang === "ru" 
        ? "❌ У вас нет прав выполнять эту команду." 
        : "❌ You don't have permission to execute this command.", 
      getMainMenu(lang)
    );
    return;
  }
  
  if (ads.length === 0) {
    bot.sendMessage(chatId, 
      lang === "uz" 
        ? "❌ Hech qanday reklama topilmadi." 
        : lang === "ru" 
        ? "❌ Объявления не найдены." 
        : "❌ No ads found.", 
      getMainMenu(lang)
    );
    return;
  }
  
  let message = lang === "uz" 
    ? "📢 Reklamalar ro'yxati:\n\n" 
    : lang === "ru" 
    ? "📢 Список объявлений:\n\n" 
    : "📢 List of ads:\n\n";
  
  ads.forEach((ad, index) => {
    message += `${index + 1}. ID: ${ad.id}\n`;
    message += lang === "uz" ? "Holat: " : lang === "ru" ? "Статус: " : "Status: ";
    message += activeAds.has(ad.id) 
      ? (lang === "uz" ? "Faol (yuborilmoqda)" : lang === "ru" ? "Активен (отправляется)" : "Active (sending)") 
      : (lang === "uz" ? "Nofaol" : lang === "ru" ? "Неактивен" : "Inactive");
    message += `\n${lang === "uz" ? "Vaqti: " : lang === "ru" ? "Время: " : "Time: "}${formatDate(ad.schedule_time, lang)}\n`;
    message += `${ad.text.substring(0, 50)}...\n\n`;
  });
  
  bot.sendMessage(chatId, message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === "uz" ? "📝 Reklamani tahrirlash" : lang === "ru" ? "📝 Редактировать объявление" : "📝 Edit ad", callback_data: "edit_ad_list" }],
        [{ text: lang === "uz" ? "🗑 Reklamani o'chirish" : lang === "ru" ? "🗑 Удалить объявление" : "🗑 Delete ad", callback_data: "delete_ad_list" }],
        [{ text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", callback_data: "back_to_main" }],
      ],
    },
  });
  updateUserActivity(msg.from.id);
});

// Foydalanuvchilar ro'yxatini ko'rish komandasi
bot.onText(/\/users/, (msg) => {
  const chatId = msg.chat.id;
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';
  
  if (!ADMIN_IDS.includes(msg.from.id.toString())) {
    bot.sendMessage(chatId, 
      lang === "uz" 
        ? "❌ Sizda bunday buyruqni bajarish huquqi yo'q." 
        : lang === "ru" 
        ? "❌ У вас нет прав выполнять эту команду." 
        : "❌ You don't have permission to execute this command.", 
      getMainMenu(lang)
    );
    return;
  }
  
  if (users.length === 0) {
    bot.sendMessage(chatId, 
      lang === "uz" 
        ? "❌ Hech qanday foydalanuvchi topilmadi." 
        : lang === "ru" 
        ? "❌ Пользователи не найдены." 
        : "❌ No users found.", 
      getMainMenu(lang)
    );
    return;
  }
  
  let message = lang === "uz" 
    ? `👥 Foydalanuvchilar soni: ${users.length}\n\n`
    : lang === "ru" 
    ? `👥 Количество пользователей: ${users.length}\n\n` 
    : `👥 Total users: ${users.length}\n\n`;
  
  // Oxirgi 10 ta foydalanuvchini ko'rsatish
  const recentUsers = users.slice(-10).reverse();
  
  recentUsers.forEach((user, index) => {
    message += `${index + 1}. ${user.first_name} ${user.last_name || ''} (@${user.username || 'foydalanuvchi'})\n`;
    message += `🆔: ${user.id}\n`;
    message += lang === "uz" 
      ? `📅 Qo'shilgan: ${formatDate(user.joined_at, lang)}\n`
      : lang === "ru" 
      ? `📅 Добавлен: ${formatDate(user.joined_at, lang)}\n` 
      : `📅 Joined: ${formatDate(user.joined_at, lang)}\n`;
    message += `🌐 ${user.language?.toUpperCase() || 'UZ'}\n\n`;
  });
  
  bot.sendMessage(chatId, message, {
    reply_markup: {
      inline_keyboard: [
        [{ 
          text: lang === "uz" ? "📥 Foydalanuvchilarni yuklab olish" : lang === "ru" ? "📥 Скачать список пользователей" : "📥 Download users list", 
          callback_data: "download_users" 
        }],
        [{ 
          text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", 
          callback_data: "back_to_main" 
        }]
      ]
    }
  });
  updateUserActivity(msg.from.id);
});

// Xabarlarni qayta ishlash
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';

  if (!text) return;

  // Orqaga tugmasi
  if (text === (lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back")) {
    bot.sendMessage(chatId, 
      lang === "uz" 
        ? "Orqaga qaytildi. Oldingi menyuga qaytdingiz." 
        : lang === "ru" 
        ? "Возврат назад. Вы вернулись в предыдущее меню." 
        : "Back. You returned to the previous menu.", 
      getMainMenu(lang)
    );
    updateUserActivity(msg.from.id);
    return;
  }

  // Asosiy menyu tugmasi
  if (text === (lang === "uz" ? "🏠 Asosiy menyu" : lang === "ru" ? "🏠 Главное меню" : "🏠 Main menu")) {
    bot.sendMessage(chatId, 
      lang === "uz" 
        ? "Asosiy menyuga qaytdingiz. Quyidagi tugmalardan birini tanlang:" 
        : lang === "ru" 
        ? "Вы вернулись в главное меню. Выберите одну из кнопок:" 
        : "You returned to the main menu. Please choose one of the buttons:", 
      getMainMenu(lang)
    );
    updateUserActivity(msg.from.id);
    return;
  }

  // Kitob qidirish
  if (text === (lang === "uz" ? "📚 Kitob qidirish" : lang === "ru" ? "📚 Поиск книги" : "📚 Search book")) {
    bot.sendMessage(chatId, 
      lang === "uz" 
        ? "📚 Kitob nomi, muallif yoki janr bo'yicha qidiring.\n\n" +
          "Qidirish uchun quyidagilardan birini kiriting:\n" +
          "- Kitob nomi (masalan: \"O'tkan kunlar\")\n" +
          "- Muallif ismi (masalan: \"Abdulla Qodiriy\")\n" +
          "- Janr (masalan: \"Badiiy\")\n\n" +
          "Yoki istalgan kalit so'zni kiriting."
        : lang === "ru" 
        ? "📚 Введите название книги, автора или жанр.\n\n" +
          "Для поиска введите одно из следующего:\n" +
          "- Название книги (например: \"Преступление и наказание\")\n" +
          "- Имя автора (например: \"Фёдор Достоевский\")\n" +
          "- Жанр (например: \"Классика\")\n\n" +
          "Или введите любое ключевое слово."
        : "📚 Search by book name, author, or genre.\n\n" +
          "To search, enter one of the following:\n" +
          "- Book title (e.g. \"Crime and Punishment\")\n" +
          "- Author name (e.g. \"Fyodor Dostoevsky\")\n" +
          "- Genre (e.g. \"Classic\")\n\n" +
          "Or enter any keyword.",
      getBackMenu(lang)
    );
    updateUserActivity(msg.from.id);
    return;
  }

  // Barcha kitoblar
  if (text === (lang === "uz" ? "📂 Barcha kitoblar" : lang === "ru" ? "📂 Все книги" : "📂 All books")) {
    bot.sendMessage(chatId, 
      lang === "uz" 
        ? "Quyidagi janrlardan birini tanlang yoki barcha kitoblarni ko'rish uchun \"Barchasi\" tugmasini bosing:" 
        : lang === "ru" 
        ? "Выберите один из жанров или нажмите \"Все\" для просмотра всех книг:" 
        : "Choose one of the genres or click \"All\" to see all books:", 
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Podkast", callback_data: "genre_Podkast" }, { text: "Audio Dars", callback_data: "genre_Audio Dars" }],
            [{ text: "Badiiy", callback_data: "genre_Badiiy" }, { text: "Ilmiy", callback_data: "genre_Ilmiy" }],
            [{ text: "Darslik", callback_data: "genre_Darslik" }, { text: "Boshqa", callback_data: "genre_Boshqa" }],
            [{ text: "Shaxsiy Rivojlanish", callback_data: "genre_Shaxsiy Rivojlanish" }],
            [{ text: "Detektiv", callback_data: "genre_Detektiv" }],
            [{ text: lang === "uz" ? "Barchasi" : lang === "ru" ? "Все" : "All", callback_data: "genre_all" }],
            [{ text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", callback_data: "back_to_main" }],
          ],
        },
      }
    );
    updateUserActivity(msg.from.id);
    return;
  }

  // Reklama kontentini qabul qilish
  if (waitingForAd[chatId] && waitingForAd[chatId].step === "waiting_for_ad_content" && ADMIN_IDS.includes(msg.from.id.toString())) {
    if (text) {
      waitingForAd[chatId].text = text;
      waitingForAd[chatId].step = "waiting_for_ad_schedule";
      bot.sendMessage(
        chatId, 
        lang === "uz" 
          ? "⏳ Reklama qachon yuborilsin?\n\n" +
            "1. Darhol yuborish uchun \"0\" yozing\n" +
            "2. Belgilangan vaqt uchun sana va vaqtni quyidagi formatda yozing: DD.MM.YYYY HH:MM\n" +
            "   Masalan: 25.12.2023 15:30\n\n" +
            "❗ Eslatma: Agar reklamani keyinroq yubormoqchi bo'lsangiz, kelajakdagi sana va vaqtni kiriting."
          : lang === "ru" 
          ? "⏳ Когда отправить объявление?\n\n" +
            "1. Напишите \"0\" для немедленной отправки\n" +
            "2. Для указания времени используйте формат: ДД.ММ.ГГГГ ЧЧ:ММ\n" +
            "   Например: 25.12.2023 15:30\n\n" +
            "❗ Примечание: Если вы хотите отправить объявление позже, укажите будущую дату и время."
          : "⏳ When should the ad be sent?\n\n" +
            "1. Write \"0\" for immediate sending\n" +
            "2. For scheduled time use format: DD.MM.YYYY HH:MM\n" +
            "   Example: 25.12.2023 15:30\n\n" +
            "❗ Note: If you want to send the ad later, enter a future date and time.",
        getBackMenu(lang)
      );
    }
    updateUserActivity(msg.from.id);
    return;
  }

  // Reklama vaqtini qabul qilish
  if (waitingForAd[chatId] && waitingForAd[chatId].step === "waiting_for_ad_schedule" && ADMIN_IDS.includes(msg.from.id.toString())) {
    if (text === "0") {
      // Darhol yuborish
      waitingForAd[chatId].schedule_time = new Date().toISOString();
      waitingForAd[chatId].step = "waiting_for_ad_confirmation";
      
      // Reklama namoyishi
      const previewText = lang === "uz" 
        ? "📢 Reklama namoyishi:\n\n" + waitingForAd[chatId].text + "\n\n" + "⏱ Yuborish vaqti: Darhol"
        : lang === "ru" 
        ? "📢 Превью объявления:\n\n" + waitingForAd[chatId].text + "\n\n" + "⏱ Время отправки: Немедленно"
        : "📢 Ad preview:\n\n" + waitingForAd[chatId].text + "\n\n" + "⏱ Send time: Immediately";
      
      if (waitingForAd[chatId].file_id) {
        const options = { 
          caption: previewText,
          parse_mode: "Markdown"
        };
        
        if (waitingForAd[chatId].file_type === "photo") {
          await bot.sendPhoto(chatId, waitingForAd[chatId].file_id, options);
        } else if (waitingForAd[chatId].file_type === "video") {
          await bot.sendVideo(chatId, waitingForAd[chatId].file_id, options);
        } else if (waitingForAd[chatId].file_type === "document") {
          await bot.sendDocument(chatId, waitingForAd[chatId].file_id, options);
        }
      } else {
        await bot.sendMessage(chatId, previewText, { parse_mode: "Markdown" });
      }
      
      bot.sendMessage(
        chatId, 
        lang === "uz" 
          ? "✅ Reklamani yuborishni tasdiqlaysizmi?\n\n" +
            "Agar reklama to'g'ri bo'lsa \"Tasdiqlash\" tugmasini bosing.\n" +
            "Agar xato bo'lsa yoki qayta tahrirlamoqchi bo'lsangiz \"Bekor qilish\" tugmasini bosing."
          : lang === "ru" 
          ? "✅ Подтверждаете отправку объявления?\n\n" +
            "Если объявление верное, нажмите кнопку \"Подтвердить\".\n" +
            "Если есть ошибка или вы хотите отредактировать, нажмите кнопку \"Отменить\"."
          : "✅ Confirm sending this ad?\n\n" +
            "If the ad is correct, press the \"Confirm\" button.\n" +
            "If there is an error or you want to edit, press the \"Cancel\" button.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: lang === "uz" ? "✅ Tasdiqlash" : lang === "ru" ? "✅ Подтвердить" : "✅ Confirm", callback_data: "confirm_ad" }],
              [{ text: lang === "uz" ? "❌ Bekor qilish" : lang === "ru" ? "❌ Отменить" : "❌ Cancel", callback_data: "cancel_ad" }],
              [{ text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", callback_data: "back_to_main" }],
            ],
          },
        }
      );
    } else {
      // Rejalashtirilgan vaqt
      const [datePart, timePart] = text.split(" ");
      const [day, month, year] = datePart.split(".").map(Number);
      const [hours, minutes] = timePart.split(":").map(Number);
      
      if (!day || !month || !year || hours === undefined || minutes === undefined) {
        bot.sendMessage(
          chatId, 
          lang === "uz" 
            ? "❌ Noto'g'ri format! Iltimos, quyidagi formatda yozing: DD.MM.YYYY HH:MM\n" +
              "Masalan: 25.12.2023 15:30\n\n" +
              "Yoki darhol yuborish uchun \"0\" yozing."
            : lang === "ru" 
            ? "❌ Неверный формат! Пожалуйста, используйте формат: ДД.ММ.ГГГГ ЧЧ:ММ\n" +
              "Например: 25.12.2023 15:30\n\n" +
              "Или напишите \"0\" для немедленной отправки."
            : "❌ Wrong format! Please use format: DD.MM.YYYY HH:MM\n" +
              "Example: 25.12.2023 15:30\n\n" +
              "Or write \"0\" for immediate sending.",
          getBackMenu(lang)
        );
        return;
      }
      
      const scheduleDate = new Date(year, month - 1, day, hours, minutes);
   if (isNaN(scheduleDate.getTime())) { 
  bot.sendMessage(
    chatId, 
    lang === "uz" 
      ? "❌ Noto'g'ri sana kiritildi! Iltimos, to'g'ri sana kiriting."
      : lang === "ru" 
      ? "❌ Введена неверная дата! Пожалуйста, введите корректную дату."
      : "❌ Invalid date entered! Please enter a correct date.",
    getBackMenu(lang)
  );
  return;
}

      
      if (scheduleDate < new Date()) {
        bot.sendMessage(
          chatId, 
          lang === "uz" 
            ? "❌ Siz o'tmishdagi vaqtni kiritdingiz! Iltimos, kelajakdagi vaqtni kiriting."
            : lang === "ru" 
            ? "❌ Вы указали прошедшее время! Пожалуйста, укажите время в будущем."
            : "❌ You entered a past time! Please enter a future time.",
          getBackMenu(lang)
        );
        return;
      }
      
      waitingForAd[chatId].schedule_time = scheduleDate.toISOString();
      waitingForAd[chatId].step = "waiting_for_ad_confirmation";
      
      // Reklama namoyishi
      const formattedTime = formatDate(scheduleDate.toISOString(), lang);
      const previewText = lang === "uz" 
        ? "📢 Reklama namoyishi:\n\n" + waitingForAd[chatId].text + "\n\n" + `⏱ Yuborish vaqti: ${formattedTime}`
        : lang === "ru" 
        ? "📢 Превью объявления:\n\n" + waitingForAd[chatId].text + "\n\n" + `⏱ Время отправки: ${formattedTime}`
        : "📢 Ad preview:\n\n" + waitingForAd[chatId].text + "\n\n" + `⏱ Send time: ${formattedTime}`;
      
      if (waitingForAd[chatId].file_id) {
        const options = { 
          caption: previewText,
          parse_mode: "Markdown"
        };
        
        if (waitingForAd[chatId].file_type === "photo") {
          await bot.sendPhoto(chatId, waitingForAd[chatId].file_id, options);
        } else if (waitingForAd[chatId].file_type === "video") {
          await bot.sendVideo(chatId, waitingForAd[chatId].file_id, options);
        } else if (waitingForAd[chatId].file_type === "document") {
          await bot.sendDocument(chatId, waitingForAd[chatId].file_id, options);
        }
      } else {
        await bot.sendMessage(chatId, previewText, { parse_mode: "Markdown" });
      }
      
      bot.sendMessage(
        chatId, 
        lang === "uz" 
          ? "✅ Reklamani yuborishni tasdiqlaysizmi?\n\n" +
            "Agar reklama to'g'ri bo'lsa \"Tasdiqlash\" tugmasini bosing.\n" +
            "Agar xato bo'lsa yoki qayta tahrirlamoqchi bo'lsangiz \"Bekor qilish\" tugmasini bosing."
          : lang === "ru" 
          ? "✅ Подтверждаете отправку объявления?\n\n" +
            "Если объявление верное, нажмите кнопку \"Подтвердить\".\n" +
            "Если есть ошибка или вы хотите отредактировать, нажмите кнопку \"Отменить\"."
          : "✅ Confirm sending this ad?\n\n" +
            "If the ad is correct, press the \"Confirm\" button.\n" +
            "If there is an error or you want to edit, press the \"Cancel\" button.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: lang === "uz" ? "✅ Tasdiqlash" : lang === "ru" ? "✅ Подтвердить" : "✅ Confirm", callback_data: "confirm_ad" }],
              [{ text: lang === "uz" ? "❌ Bekor qilish" : lang === "ru" ? "❌ Отменить" : "❌ Cancel", callback_data: "cancel_ad" }],
              [{ text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", callback_data: "back_to_main" }],
            ],
          },
        }
      );
    }
    updateUserActivity(msg.from.id);
    return;
  }

  // Kitob qidirish funksiyasi
  if (text !== "/start") {
    const results = books.filter(
      (b) => b.id === text || b.name.toLowerCase().includes(text.toLowerCase()) || b.author?.toLowerCase().includes(text.toLowerCase()) || b.genre?.toLowerCase().includes(text.toLowerCase())
    );

    if (results.length) {
      results.forEach((book) => {
        let caption = `📖 *${book.name}*\n👤 *${lang === "uz" ? "Muallif" : lang === "ru" ? "Автор" : "Author"}:* ${book.author}\n📂 *${lang === "uz" ? "Janr" : lang === "ru" ? "Жанр" : "Genre"}:* ${book.genre}\n\n${CHANNEL_LINK}`;
        if (book.file_id) {
          if (book.file_type === "document") {
            bot.sendDocument(chatId, book.file_id, { 
              caption, 
              parse_mode: "Markdown",
              reply_markup: getBackMenu(lang).reply_markup
            });
          } else if (book.file_type === "photo") {
            bot.sendPhoto(chatId, book.file_id, { 
              caption, 
              parse_mode: "Markdown",
              reply_markup: getBackMenu(lang).reply_markup
            });
          } else if (book.file_type === "video") {
            bot.sendVideo(chatId, book.file_id, { 
              caption, 
              parse_mode: "Markdown",
              reply_markup: getBackMenu(lang).reply_markup
            });
          } else if (book.file_type === "audio") {
            bot.sendAudio(chatId, book.file_id, { 
              caption, 
              parse_mode: "Markdown",
              reply_markup: getBackMenu(lang).reply_markup
            });
          } else if (book.file_type === "voice") {
            bot.sendVoice(chatId, book.file_id, { 
              caption, 
              parse_mode: "Markdown",
              reply_markup: getBackMenu(lang).reply_markup
            });
          }
        } else {
          bot.sendMessage(
            chatId, 
            `⚠️ ${book.name} ${lang === "uz" ? "mavjud, lekin fayli yo'q." : lang === "ru" ? "есть, но файл отсутствует." : "exists, but the file is missing."}`, 
            { 
              parse_mode: "Markdown",
              reply_markup: getBackMenu(lang).reply_markup
            }
          );
        }
      });
    } else {
      bot.sendMessage(
        chatId, 
        lang === "uz" 
          ? "❌ Kitob topilmadi. Boshqa kalit so'zlar bilan qayta urinib ko'ring yoki \"Barcha kitoblar\" tugmasini bosing." 
          : lang === "ru" 
          ? "❌ Книга не найдена. Попробуйте с другими ключевыми словами или нажмите кнопку \"Все книги\"." 
          : "❌ Book not found. Try with other keywords or press \"All books\" button.",
        getBackMenu(lang)
      );
    }
    updateUserActivity(msg.from.id);
  }
});

// Fayllarni qabul qilish
bot.on("document", (msg) => processFile(msg, "document"));
bot.on("photo", (msg) => processFile(msg, "photo"));
bot.on("video", (msg) => processFile(msg, "video"));
bot.on("audio", (msg) => processFile(msg, "audio"));
bot.on("voice", (msg) => processFile(msg, "voice"));

async function processFile(msg, type) {
  const chatId = msg.chat.id;
  const user = users.find(u => u.id === msg.from.id);
  const lang = user?.language || 'uz';

  // Reklama uchun fayl qabul qilish
  if (waitingForAd[chatId] && waitingForAd[chatId].step === "waiting_for_ad_content" && ADMIN_IDS.includes(msg.from.id.toString())) {
    let file_id = type === "photo" ? msg.photo[msg.photo.length - 1].file_id : msg[type].file_id;
    waitingForAd[chatId].file_id = file_id;
    waitingForAd[chatId].file_type = type;
    
    bot.sendMessage(
      chatId, 
      lang === "uz" 
        ? "📝 Reklama uchun matn yozing (ushbu media fayl bilan birga yuboriladi):\n\n" +
          "1. Reklama matnini yozing\n" +
          "2. Matn HTML formatida bo'lishi mumkin (bold, italic, linklar)\n" +
          "3. Agar matn yozishni xohlamasangiz, faqat media faylni yuborish uchun \"0\" yozing"
        : lang === "ru" 
        ? "📝 Напишите текст для объявления (оно будет отправлено с этим медиафайлом):\n\n" +
          "1. Введите текст объявления\n" +
          "2. Текст может быть в HTML формате (жирный, курсив, ссылки)\n" +
          "3. Если вы не хотите добавлять текст, напишите \"0\" для отправки только медиафайла"
        : "📝 Write text for the ad (it will be sent with this media file):\n\n" +
          "1. Enter the ad text\n" +
          "2. Text can be in HTML format (bold, italic, links)\n" +
          "3. If you don't want to add text, write \"0\" to send only the media file",
      getBackMenu(lang)
    );
    updateUserActivity(msg.from.id);
    return;
  }
}

// Callback query handler
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const user = users.find(u => u.id === query.from.id);
  const lang = user?.language || 'uz';
  const data = query.data;

  // Til tanlash
  if (["uz", "ru", "en"].includes(data)) {
    updateUserLanguage(query.from.id, data);
    bot.sendMessage(chatId, 
      data === "uz" 
        ? "✅ O'zbek tili tanlandi! Endi siz botdan to'liq foydalanishingiz mumkin." 
        : data === "ru" 
        ? "✅ Выбран русский язык! Теперь вы можете полноценно пользоваться ботом." 
        : "✅ English language selected! Now you can use the bot fully.",
      getMainMenu(data)
    );
    updateUserActivity(query.from.id);
    return;
  }

  // Janr tanlash
  if (data.startsWith("genre_")) {
    const genre = data.replace("genre_", "");
    let filteredBooks = genre === "all" ? books : books.filter((b) => b.genre === genre);

    if (filteredBooks.length) {
      let message = lang === "uz" 
        ? "📚 Kitoblar ro'yxati:\n\n" 
        : lang === "ru" 
        ? "📚 Список книг:\n\n" 
        : "📚 List of books:\n\n";
      
      filteredBooks.forEach((book, index) => {
        message += `\n\n${index + 1}. *${book.name}* (${book.author})\n📂 ${lang === "uz" ? "Janr" : lang === "ru" ? "Жанр" : "Genre"}: ${book.genre}\n🆔 ID: ${book.id}`;
      });
      
      bot.sendMessage(chatId, message, { 
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", callback_data: "back_to_main" }]
          ]
        }
      });
    } else {
      bot.sendMessage(
        chatId, 
        lang === "uz" 
          ? "❌ Ushbu janrda kitob topilmadi. Boshqa janrni tanlang yoki \"Barchasi\" tugmasini bosing." 
          : lang === "ru" 
          ? "❌ Книги в этом жанре не найдены. Выберите другой жанр или нажмите кнопку \"Все\"." 
          : "❌ No books found in this genre. Choose another genre or press \"All\" button.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", callback_data: "back_to_main" }]
            ]
          }
        }
      );
    }
    updateUserActivity(query.from.id);
    return;
  }

  // Reklamani tasdiqlash
  if (data === "confirm_ad") {
    const adId = Date.now().toString();
    
    const newAd = {
      id: adId,
      text: waitingForAd[chatId].text,
      file_id: waitingForAd[chatId].file_id,
      file_type: waitingForAd[chatId].file_type,
      schedule_time: waitingForAd[chatId].schedule_time,
      created_at: new Date().toISOString(),
    };
    
    ads.push(newAd);
    saveAds();
    
    const delaySeconds = Math.floor((new Date(newAd.schedule_time) - new Date())) / 1000;
    broadcastAd(newAd, delaySeconds > 0 ? delaySeconds : 0);
    
    bot.sendMessage(
      chatId, 
      lang === "uz" 
        ? `✅ Reklama muvaffaqiyatli qo'shildi! ${delaySeconds > 0 ? `U ${formatDate(newAd.schedule_time, lang)} da barcha foydalanuvchilarga yuboriladi.` : "U darhol barcha foydalanuvchilarga yuborildi."}\n\n` +
          `Reklama ID: ${adId}\n` +
          `Foydalanuvchilar soni: ${users.length}`
        : lang === "ru" 
        ? `✅ Объявление успешно добавлено! ${delaySeconds > 0 ? `Оно будет отправлено всем пользователям ${formatDate(newAd.schedule_time, lang)}.` : "Оно было немедленно отправлено всем пользователям."}\n\n` +
          `ID объявления: ${adId}\n` +
          `Количество пользователей: ${users.length}`
        : `✅ Ad added successfully! ${delaySeconds > 0 ? `It will be sent to all users at ${formatDate(newAd.schedule_time, lang)}.` : "It was sent to all users immediately."}\n\n` +
          `Ad ID: ${adId}\n` +
          `Users count: ${users.length}`,
      getMainMenu(lang)
    );
    
    delete waitingForAd[chatId];
    updateUserActivity(query.from.id);
    return;
  }

  // Reklamani bekor qilish
  if (data === "cancel_ad") {
    bot.sendMessage(
      chatId, 
      lang === "uz" 
        ? "❌ Reklama yuborish bekor qilindi. Yangi reklama yuborish uchun /addreklama buyrug'ini yuboring." 
        : lang === "ru" 
        ? "❌ Отправка объявления отменена. Для создания нового объявления отправьте команду /addreklama." 
        : "❌ Ad sending canceled. To create a new ad, send /addreklama command.",
      getMainMenu(lang)
    );
    delete waitingForAd[chatId];
    updateUserActivity(query.from.id);
    return;
  }

  // Reklamani tahrirlash
  if (data.startsWith("edit_ad_")) {
    const adId = data.replace("edit_ad_", "");
    const ad = ads.find(a => a.id === adId);
    
    if (!ad) {
      bot.sendMessage(
        chatId, 
        lang === "uz" 
          ? "❌ Reklama topilmadi. Yangi reklama yuborish uchun /addreklama buyrug'ini yuboring." 
          : lang === "ru" 
          ? "❌ Объявление не найдено. Для создания нового объявления отправьте команду /addreklama." 
          : "❌ Ad not found. To create a new ad, send /addreklama command.",
        getMainMenu(lang)
      );
      return;
    }
    
    waitingForAd[chatId] = { 
      step: "waiting_for_edited_ad_content", 
      editingAdId: adId,
      currentAd: ad
    };
    
    bot.sendMessage(
      chatId, 
      lang === "uz" 
        ? "✏️ Yangi reklama kontentini yuboring (matn, rasm, video yoki hujjat):\n\n" +
          "1. Yangi matn yuboring\n" +
          "2. Yangi media fayl yuboring (agar kerak bo'lsa)\n" +
          "3. Agar faqat matnni o'zgartirmoqchi bo'lsangiz, matn yuboring\n" +
          "4. Agar faqat media faylni o'zgartirmoqchi bo'lsangiz, yangi fayl yuboring"
        : lang === "ru" 
        ? "✏️ Отправьте новый контент объявления (текст, изображение, видео или документ):\n\n" +
          "1. Отправьте новый текст\n" +
          "2. Отправьте новый медиафайл (если необходимо)\n" +
          "3. Если вы хотите изменить только текст, отправьте текст\n" +
          "4. Если вы хотите изменить только медиафайл, отправьте новый файл"
        : "✏️ Send new ad content (text, photo, video or document):\n\n" +
          "1. Send new text\n" +
          "2. Send new media file (if needed)\n" +
          "3. If you want to change only text, send text\n" +
          "4. If you want to change only media file, send new file",
      getBackMenu(lang)
    );
    updateUserActivity(query.from.id);
    return;
  }

  // Reklamani o'chirish
  if (data.startsWith("delete_ad_")) {
    const adId = data.replace("delete_ad_", "");
    const deleted = deleteAd(adId);
    
    if (deleted) {
      bot.sendMessage(
        chatId, 
        lang === "uz" 
          ? `✅ Reklama muvaffaqiyatli o'chirildi! (ID: ${adId})\n\n` +
            "Yangi reklama yuborish uchun /addreklama buyrug'ini yuboring."
          : lang === "ru" 
          ? `✅ Объявление успешно удалено! (ID: ${adId})\n\n` +
            "Для создания нового объявления отправьте команду /addreklama."
          : `✅ Ad deleted successfully! (ID: ${adId})\n\n` +
            "To create a new ad, send /addreklama command.",
        getMainMenu(lang)
      );
    } else {
      bot.sendMessage(
        chatId, 
        lang === "uz" 
          ? "❌ Reklamani o'chirishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring." 
          : lang === "ru" 
          ? "❌ Произошла ошибка при удалении объявления. Пожалуйста, попробуйте снова." 
          : "❌ Error deleting ad. Please try again.",
        getMainMenu(lang)
      );
    }
    updateUserActivity(query.from.id);
    return;
  }

  // Foydalanuvchilar ro'yxatini yuklab olish
  if (data === "download_users") {
    try {
      const csvContent = "ID,Username,First Name,Last Name,Language,Joined At,Last Active\n" +
        users.map(user => 
          `${user.id},${user.username || ''},${user.first_name},${user.last_name || ''},${user.language || 'uz'},${user.joined_at},${user.last_active}`
        ).join("\n");
      
      fs.writeFileSync(path.join(__dirname, "users.csv"), csvContent);
      
      await bot.sendDocument(chatId, path.join(__dirname, "users.csv"), {
        caption: lang === "uz" 
          ? "📊 Foydalanuvchilar ro'yxati\n\n" +
            "Fayl format: CSV\n" +
            "Foydalanuvchilar soni: " + users.length + "\n" +
            "Yuklab olish vaqti: " + formatDate(new Date().toISOString(), lang)
          : lang === "ru" 
          ? "📊 Список пользователей\n\n" +
            "Формат файла: CSV\n" +
            "Количество пользователей: " + users.length + "\n" +
            "Время загрузки: " + formatDate(new Date().toISOString(), lang)
          : "📊 Users list\n\n" +
            "File format: CSV\n" +
            "Users count: " + users.length + "\n" +
            "Download time: " + formatDate(new Date().toISOString(), lang),
        reply_markup: {
          inline_keyboard: [
            [{ text: lang === "uz" ? "🔙 Orqaga" : lang === "ru" ? "🔙 Назад" : "🔙 Back", callback_data: "back_to_main" }]
          ]
        }
      });
      
      fs.unlinkSync(path.join(__dirname, "users.csv"));
    } catch (error) {
      console.error("Foydalanuvchilar ro'yxatini yuklab olishda xato:", error);
      bot.sendMessage(
        chatId, 
        lang === "uz" 
          ? "❌ Foydalanuvchilar ro'yxatini yuklab olishda xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring." 
          : lang === "ru" 
          ? "❌ Произошла ошибка при загрузке списка пользователей. Пожалуйста, попробуйте позже." 
          : "❌ Error downloading users list. Please try again later.",
        getMainMenu(lang)
      );
    }
    updateUserActivity(query.from.id);
    return;
  }

  // Asosiy menyuga qaytish
  if (data === "back_to_main" || data === "back_to_ads") {
    bot.sendMessage(
      chatId, 
      lang === "uz" 
        ? "🏠 Asosiy menyuga qaytdingiz. Quyidagi tugmalardan birini tanlang:" 
        : lang === "ru" 
        ? "🏠 Вы вернулись в главное меню. Выберите одну из кнопок:" 
        : "🏠 You returned to the main menu. Please choose one of the buttons:", 
      getMainMenu(lang)
    );
    updateUserActivity(query.from.id);
    return;
  }
});

console.log("✅ Bot ishga tushdi...");
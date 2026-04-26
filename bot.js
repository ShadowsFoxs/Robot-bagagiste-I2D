const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1497993520810688602';
const JSON_URL = 'https://mocha.nationsglory.fr/tiles/_markers_/marker_world.json';

let cachedData = null;

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

async function fetchData() {
    try {
        console.log('🔄 Récupération...');
        const response = await axios.get(JSON_URL);
        const markers = response.data.sets["factions.markerset"].markers;
        const countries = [];
        
        for (const [key, value] of Object.entries(markers)) {
            const name = value.label.replace(" [home]", "");
            const desc = value.desc || "";
            const claimsMatch = desc.match(/Claims<\/b>\s*(\d+)/);
            const powerMatch = desc.match(/Power<\/b>\s*(\d+)\s*\/\s*(\d+)/);
            const leaderMatch = desc.match(/Leader du pays<\/span><br\/>\s*<img[^>]+>\s*([^<]+)/);
            
            let claims = claimsMatch ? parseInt(claimsMatch[1]) : 0;
            let power = powerMatch ? parseInt(powerMatch[1]) : 0;
            let leader = leaderMatch ? leaderMatch[1].trim() : "Inconnu";
            
            if (claims > power && claims > 0) {
                countries.push({ name, claims, power, deficit: claims - power, leader });
            }
        }
        countries.sort((a, b) => b.deficit - a.deficit);
        cachedData = { countries, count: countries.length, updateTime: new Date() };
        console.log(`✅ ${cachedData.count} pays en danger`);
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

const commands = [new SlashCommandBuilder().setName('sp').setDescription('⚠️ Pays en sous-power')];

client.once('ready', async () => {
    console.log(`🤖 Bot: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands.map(cmd => cmd.toJSON()) });
    await fetchData();
    setInterval(fetchData, 10 * 60 * 1000);
    client.user.setPresence({ activities: [{ name: '/sp', type: 3 }] });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    await interaction.deferReply();
    if (!cachedData) return interaction.editReply('🔄 Chargement...');
    
    if (cachedData.count === 0) {
        const embed = new EmbedBuilder().setColor(0x00FF00).setTitle('✅ Aucun pays en danger');
        return interaction.editReply({ embeds: [embed] });
    }
    
    let list = '';
    for (let i = 0; i < Math.min(cachedData.countries.length, 20); i++) {
        const c = cachedData.countries[i];
        list += `**${i+1}. ${c.name}** | 🏰 ${c.claims} | ⚡ ${c.power} | 📉 -${c.deficit}\n`;
    }
    const embed = new EmbedBuilder().setColor(0xFF4444).setTitle(`⚠️ ${cachedData.count} pays en danger`).setDescription(list);
    await interaction.editReply({ embeds: [embed] });
});

client.login(TOKEN);
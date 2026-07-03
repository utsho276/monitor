// ==UserScript==
// @name         Microworkers TTV Telegram Scraper
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Scrapes jobs immediately after page load and sends ONE combined TG message.
// @author       Utsho
// @match        https://www.microworkers.com/jobs.php*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // ============== CONFIGURATION ==============
    const TG_TOKEN = "8274836388:AAETjh1CjBr_+spoShrjaVPCIKE5hG1c0rhs";
    const TG_CHAT_ID = "-1003737886902";
    const FILTER_KEYWORD = "TTV-Data Entry";
    
    // Fake campaigns to ignore
    const BLOCKED_LINKS = [
        "b911cf2ca7e9",
        "fbdb2ffa19e4",
        "da197ff63255",
        "1812d5367bee",
        "e6b0d7385159",
        "921a90657506",
        "9b4aba82e28f",
        "601c0f3573c6",
        "baae67889675",
        "d240a87b3641",
        "bc196f983541",
        "f1191eabcaf0",
        "294034f34839",
        "743818b1e37a",
        "92191e3abe85",
        "5fbfb506e7b3"
        
    ];
    // ===========================================

    console.log("🟢 TTV Scraper: Page loaded. Scanning for jobs...");

    // Helper to format Date for Bangladesh
    function getBDTime() {
        const d = new Date();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const day = d.toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: '2-digit' });
        const monthNum = d.toLocaleString("en-GB", { timeZone: "Asia/Dhaka", month: 'numeric' });
        const monthStr = months[parseInt(monthNum) - 1];
        const time = d.toLocaleString("en-GB", { timeZone: "Asia/Dhaka", hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        
        return `${day} ${monthStr}, ${time} BD`;
    }

    function sendCombinedTelegramAlert(jobs) {
        if (jobs.length === 0) return;

        let text = `🟢🟢 <b>TTV-Data Entry Jobs Found!</b> 🟢🟢\n\n`;
        let keyboardRows = [];

        jobs.forEach((job, index) => {
            const num = index + 1;
            // Matches user format with 1. and *2.* (now <b>)
            const prefix = num % 2 === 0 ? `<b>${num}.</b>` : `${num}.`;

            text += `📌 ${prefix} ${job.title}\n`
                  + `🔗 ${job.link}\n\n`
                  + `✅ Done: ${job.done} ${job.slotsBaki}\n\n`;

            keyboardRows.push([
                { text: `🥓 Copy Link ${num}`, copy_text: { text: job.link } }
            ]);
        });

        text += `🕐 ${getBDTime()}`;

        const payload = {
            chat_id: TG_CHAT_ID,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: keyboardRows
            }
        };

        // Send to Telegram
        GM_xmlhttpRequest({
            method: "POST",
            url: `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify(payload),
            onload: function() {
                console.log("📤 Telegram combined notification sent successfully!");
            }
        });

        // ⚠️ ACTION REQUIRED: Put your Firebase URL here ending with /jobs.json
        const FIREBASE_URL_FOR_TTV = "https://utsho-campaign-manager-pro-default-rtdb.asia-southeast1.firebasedatabase.app/jobs.json";
        
        // Push realtime data to Firebase Database
        if (!FIREBASE_URL_FOR_TTV.includes("YOUR-FIREBASE-PROJECT-NAME")) {
            
            // 1. Fetch current data from Firebase first to prevent stale overwrites
            fetch(FIREBASE_URL_FOR_TTV)
                .then(res => res.json())
                .then(existingData => {
                    const patchPayload = {};
                    let hasUpdates = false;

                    jobs.forEach(job => {
                        const match = job.title.match(/[-( ]([a-zA-Z0-9]+)\)/);
                        const code = match ? match[1] : btoa(job.title).substring(0, 8);
                        
                        // Extract current done count (e.g. from "524/531" -> 524)
                        const currentDoneInt = parseInt(job.done.split('/')[0]) || 0;
                        
                        // Check if we should ignore this due to stale data
                        if (existingData && existingData[code]) {
                            const oldJob = existingData[code];
                            // If link is exactly the same, check done count
                            if (oldJob.link === job.link) {
                                const oldDoneInt = parseInt(oldJob.done.split('/')[0]) || 0;
                                if (currentDoneInt < oldDoneInt) {
                                    console.log(`⚠️ Blocked stale data from lagging PC for Code ${code}. (${currentDoneInt} < ${oldDoneInt})`);
                                    return; // SKIPS patching this specific job!
                                }
                            }
                        }
                        
                        // Use Firebase's Universal Server Time
                        job.timestamp = { ".sv": "timestamp" };
                        patchPayload[code] = job;
                        hasUpdates = true;
                    });

                    // 2. Patch only if we have valid newer updates
                    if (hasUpdates) {
                        fetch(FIREBASE_URL_FOR_TTV, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(patchPayload)
                        }).then(res => res.json())
                          .then(data => console.log("☁️ Data Patched to Firebase Cloud:", data))
                          .catch(err => console.log("⚠️ Firebase PATCH Error:", err));
                    } else {
                         console.log("☁️ No new updates to patch (stale data ignored).");
                    }
                })
                .catch(err => console.log("⚠️ Firebase GET Error:", err));
        }
    }

    let memoryDB = {}; // Remembers jobs only until the page is reloaded!

    function scrapeCurrentPage() {
        const jobRows = document.querySelectorAll('.jobslist');
        let foundJobs = [];

        jobRows.forEach(row => {
            const jobNameDiv = row.querySelector('.jobname a');
            if (!jobNameDiv) return;
            
            const titleText = jobNameDiv.textContent.trim();
            const lowerTitle = titleText.toLowerCase();
            
            // "TTV-Data Entry wala campagin shudhu dekhate hobe"
            if (lowerTitle.includes(FILTER_KEYWORD.toLowerCase())) {
                
                const href = jobNameDiv.getAttribute('href'); 
                
                // Check if this is a blocked fake campaign
                const isBlocked = BLOCKED_LINKS.some(blockedId => href.includes(blockedId));
                if (isBlocked) return; // Skip this job!

                // Extract Job ID
                let jobId;
                const matchInfo = href.match(/info\/([a-zA-Z0-9_]+)/);
                const matchId = href.match(/Id=([a-zA-Z0-9_]+)/);
                
                if (matchInfo) {
                    jobId = matchInfo[1];
                } else if (matchId) {
                    jobId = matchId[1];
                } else {
                    jobId = btoa(titleText).substring(0, 15);
                }

                // If we already sent a notification for this job DURING THIS SPECIFIC PAGE LOAD, skip it.
                if (memoryDB[jobId]) return;

                // Done parsing
                let doneRaw = "Unknown";
                let slotsBaki = "";
                const doneDiv = row.querySelector('.jobdone');
                if (doneDiv) {
                    doneRaw = doneDiv.textContent.replace(/\s+/g, '').trim(); // e.g. "524/531"
                    const parts = doneRaw.split('/');
                    if (parts.length === 2) {
                        const current = parseInt(parts[0]);
                        const total = parseInt(parts[1]);
                        const left = total - current;
                        if (!isNaN(left)) {
                            slotsBaki = `(${left} slots বাকি)`;
                        }
                    }
                }

                // Normalize link
                let jobLink = href;
                if (jobLink.startsWith("//")) {
                    jobLink = "https:" + jobLink;
                } else if (jobLink.startsWith("/")) {
                    jobLink = "https://www.microworkers.com" + jobLink;
                }

                foundJobs.push({
                    title: titleText,
                    done: doneRaw,
                    slotsBaki: slotsBaki,
                    link: jobLink
                });

                // Mark as notified in memory
                memoryDB[jobId] = true;
            }
        });
        
        if (foundJobs.length > 0) {
             console.log(`✅ Scrape complete. Found ${foundJobs.length} new jobs. Grouping into ONE SMS.`);
             sendCombinedTelegramAlert(foundJobs);
        }
    }

    // Run the scraper exactly once, 1.5 seconds after the page fully loads.
    // This removes any CPU load while waiting for the next 30-second reload!
    window.addEventListener('load', () => {
        setTimeout(scrapeCurrentPage, 1500);
    });

})();

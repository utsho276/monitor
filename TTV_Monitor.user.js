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

    
                    });

                    // 2. Patch only if we have valid newer updates
                    if (hasUpdates) {
                        fetch(FIREBASE_URL_FOR_TTV, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(patchPayload)
                        }).
        
        if (foundJobs.length > 0) {
             console.log(`✅ Scrape complete. Found ${foundJobs.length} new jobs. Grouping into ONE SMS.`);
             sendCombinedTelegramAlert(foundJobs);


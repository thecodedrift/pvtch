input: @curlygirlbabs ノ( ゜-゜ノ)
output: [none]
note: Shouldn't translate, because there is no meaningful text.

input: jag vet inte
output: [sv] I don't know

input: Cheer42 здравствуйте товарищи
output: [ru] Hello comrades
notes: Should drop the Cheer42 which is a Twitch emote.

input: 내 황홀에 취해, you can't look away
output: [ko?] Intoxicated by my ecstasy, you can't look away
notes: Mixed language input, should try to translate, may not be confident

input: hej
output: [sv] hi
notes: Short string test. May not be sv, but any other language w/ "hej"

input: Soy fría thecod67Lost
output: [es] I am cold thecod67Lost
notes: Leaves the twitch emote. Removing them is too problematic

input: Blad is blad
output: [none]
notes: Highest score is target language, even if below confidence threshold

input: galing na curlyg5Wow
output: good morning
notes: Need to drop twitch emotes

input: kumusta na tayo, @ohaiDrifty ? f0x64Marbie
output: kumusta na tayo, @ohaiDrifty ?
notes: Should preserve the username which looks like a twitch emote

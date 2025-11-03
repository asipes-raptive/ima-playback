Here are some URLs for VAST Payloads.

const adTagUrls = [
{
adTagUrl: 'https://vast-tags.com/tag/15_etsy',
isVpaid: false,
},
{
adTagUrl: 'https://vast-tags.com/tag/15_garden_of_life',
isVpaid: false,
},
{
adTagUrl: 'https://vast-tags.com/tag/15_squarespace',
isVpaid: false,
},
{
adTagUrl: 'https://vast-tags.com/tag/15_hulu',
isVpaid: true,
},
{
adTagUrl: 'https://vast-tags.com/tag/15_honda',
isVpaid: true,
},
{
adTagUrl: 'https://vast-tags.com/tag/15_vital_protein',
isVpaid: true,
},
];

I want to be able to loop through each of these. They should play automatically. There should be no sound.

I want a little button that logs whether the play of a give ad was successfully or failed.

I want play/pause button to control playback of the video.

I want a skip button that lets me go to the next add.

I want a drop down that lets me pick whether I want nonvpaid and vpaid ads, just nonvpaid, and just vpaid.

Look at my index.html I already have an make it happen.

You can split CSS and Javascript into their own files, I am going to use GitHub pages to host.

// AMS-02 & logistics carriers · ELC-1 & ELC-3 carriers.
import { part } from '../core/station.js';
import { seatedPayload } from '../core/payloads.js';

part('s3payloads', 'AMS-02 & logistics carriers', '25 / EXTERNAL PAYLOADS', 'External payloads on the starboard S3 truss, measured on the supplied GLB and redrawn part by part. The Alpha Magnetic Spectrometer stands on the inboard zenith site and ExPRESS Logistics Carrier 2 outboard; ELC-4 hangs from the inboard nadir site and External Stowage Platform 3 outboard. In this model the zenith sites bridge the mobile-transporter rails.', [['AMS-02 installed', 'MAY 2011'], ['Attach sites shown', '2 zenith · 2 nadir']], [19.35, 7, 4], (kit, group) => {
    group.userData.attachSites = 4;
    for (const name of ['AMS-02', 'ELC-2', 'ELC-4', 'ESP-3']) group.add(seatedPayload(kit, name));
});
part('p3payloads', 'ELC-1 & ELC-3 carriers', '26 / EXTERNAL PAYLOADS', 'ExPRESS Logistics Carriers on the port P3 truss, measured on the supplied GLB and redrawn part by part. ELC-3 stands on the zenith attach site and ELC-1 hangs from the nadir site, both at the outboard station, each carrying equipment on both faces of its lattice deck.', [['ELC-1 installed', 'NOV 2009'], ['ELC-3 installed', 'MAY 2011']], [-21.49, 7, 4], (kit, group) => {
    group.userData.attachSites = 2;
    for (const name of ['ELC-3', 'ELC-1']) group.add(seatedPayload(kit, name));
});

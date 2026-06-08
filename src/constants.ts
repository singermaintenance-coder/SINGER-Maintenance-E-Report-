import { Machine, Factory, User } from './types';

export const FACTORIES: Factory[] = ['Agro', 'Modular', 'Solid', 'Sofa', 'Other'];
export const DEPARTMENTS = FACTORIES;
export const SUB_LOCATIONS = ['AGRO FACTORY', 'MODULAR FACTORY', 'SOLID FACTORY', 'SOFA FACTORY', 'MAIN OFFICE', 'WAREHOUSE', 'PUMP ROOM', 'GENERATOR ROOM'];

export const MACHINES: Machine[] = [
  // Agro Division
  { id: '3bsy7phjs', name: 'HYDRAULIC LATHE', department: 'Agro', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/HYDRAULIC%20LATHE%201%20(HMT).png' },
  { id: '57xrcp7tj', name: 'MULTIPLE DRILL VERTICAL', department: 'Agro', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/MULTIPLE%20DRILL%201%20(VERTICAL).png' },
  { id: '9b6wcpct4', name: 'CNC TURRET LATHE YANG', department: 'Agro', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CNC%20TURRET%20LATHE%20(YANG).png' },
  { id: 'asze3yqva', name: 'HYDRAULIC PRESS', department: 'Agro', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/HYDRAULIC%20PRESS.png' },
  { id: 'hr6n9p7wx', name: 'CENTER LATHE', department: 'Agro', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CENTER%20LATHE%201.png' },
  { id: 'i4o1yg82p', name: 'PAINT BOOTH', department: 'Agro', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/PAINT%20BOOTH.png' },
  { id: 'khlee31uk', name: 'TURRET LATHE', department: 'Agro', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/TURRET%20LATHE.png' },
  { id: 'klk3zv8zn', name: 'MECHANICAL SHEAR', department: 'Agro', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/MECHANICAL%20SHEAR.png' },
  { id: 's6yscboeg', name: 'SPOT WELDER', department: 'Agro', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/SPOT%20WELDER%201.png' },
  { id: 'sd86hbu4h', name: 'MIG WELDER', department: 'Agro', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/MIG%20WELDER%201.png' },
  { id: 'teoxqph26', name: 'RADIAL DRILL', department: 'Agro', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/RADIAL%20DRILL%201.png' },
  { id: 'ubj8ndru2', name: 'CNC TURRET LATHE ECCOCA', department: 'Agro', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CNC%20TURRET%20LATHE%20(ECCOCA%201).png' },
  { id: 'mta3cyvgy', name: 'SHOT TUM BLAST', department: 'Agro', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/SHOT%20TUM%20BLAST.png' },

  // Modular Division
  { id: 'xrho4kkgs', name: 'BEAM SAW SCM', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CNC%20BEAM%20SAW%20SCM.png' },
  { id: 'tto2ztppb', name: 'BEAM SAW SELCO', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CNC%20BEAM%20SAW%20SELCO.png' },
  { id: 'm70zi93ar', name: 'AUTO EDGE BANDER NEW JADE 340', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/AUTO%20EDGE%20BANDER%20NEW%20JADE%20340.png' },
  { id: 'vfpfzbsc6', name: 'AUTO EDGE BANDER OLD JADE 340', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/AUTO%20EDGE%20BANDER%20OLD%20JADE%20340.png' },
  { id: 'sp9nvciik', name: 'SKIPPER 100', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/SKIPPER%20100.png' },
  { id: 'u10s9yllm', name: 'ROVER GOLD OLD', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/ROVER%20GOLD%20OLD.png' },
  { id: '1rxaelkla', name: 'ROVER GOLD NEW', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/ROVER%20GOLD%20NEW.png' },
  { id: 'ss2oknf13', name: 'ROVER 22', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/ROVER%2022.png' },
  { id: '1b0eh4p4a', name: 'PROFILE EDGE BANDING MACHINE', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/PROFILE%20EDGE%20BANDING%20MACHINE.png' },
  { id: 'owoy5b835', name: 'RAIL BORER', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/RAIL%20BORER%20.jpg' },
  { id: 'jfq16inm5', name: 'DOWEL MILLING AND CUTTING MACHINE', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/DOWEL%20MILLING%20AND%20CUTTING%20MACHINE.jpg' },
  { id: '5j0898k83', name: 'MANUAL EDGE BANDER JAI MODULAR', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/MANUAL%20EDGE%20BANDER%20JAI%20MODULAR.png' },
  { id: 'p6acbc2ru', name: 'HINGE DRILLING MACHINE', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/HINGE%20DRILLING%20MACHINE.png' },
  { id: 'clg5d4bt2', name: 'GROOVING CUTTING MACHINE', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/GROOVING%20CUTTING%20MACHINE.png' },
  { id: 'yz5mpohxz', name: 'TRIMMING MACHINE', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/TRIMMING%20MACHINE.png' },
  { id: '4dhf4i94l', name: 'TABLE RIP SAW', department: 'Modular', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/TABLE%20RIP%20SAW.png' },

  // Solid Division
  { id: '03fdjz4vh', name: 'TENNONER', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/TENNONER.png' },
  { id: '0kezhoe1z', name: 'OVER HEAD ROUTER', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/OVER%20HEAD%20ROUTER.png' },
  { id: '0sfdx6xww', name: 'V SAW OLD', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/VARIETY%20SAW.png' },
  { id: '0tvd3trkl', name: 'CROSS CUTTER 5', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CROSS%20CUTTER%201.png' },
  { id: '0vxpshiw7', name: 'EDGE PROFILE SANDER 2', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/EDGE%20PROFILE%20SANDER%20.png' },
  { id: '1oq5h45wn', name: 'HORIZONTAL BORER', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/HORIZONTAL%20BORER.png' },
  { id: '2kpri06di', name: 'EDGE PROFILE SANDER 1', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/EDGE%20PROFILE%20SANDER%20.png' },
  { id: '33w8m58il', name: 'MULTI RIP SAW', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/MULTI%20RIP%20SAW.png' },
  { id: '3jcsj9m0t', name: 'RIP SAW (SINGLE)', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/RIP%20SAW%20(SINGLE).png' },
  { id: '7rheu65ma', name: 'PAINT BOOTH 3', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/PAINT%20BOOTH.png' },
  { id: '9xx6a9e0x', name: 'COPY LATHE', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/COPY%20LATHE.png' },
  { id: 'b7kv0j36i', name: 'DRILLING MACHINE', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/DRILLING%20MACHINE.png' },
  { id: 'b8au7toy7', name: 'CROSS CUTTER 1', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CROSS%20CUTTER%201.png' },
  { id: 'boglm4niy', name: 'CLAMPING MACHINE (HOLYTEC)', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/WOOD%20CLAMPING%20MACHINE.png' },
  { id: 'd6oq5fvhp', name: 'CNC ROUTER (ROVER B4)', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CNC%20ROUTER%20(ROVER%20B4).png' },
  { id: 'dr6roiukt', name: 'COPY SHAPER', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/COPY%20SHAPER.png' },
  { id: 'drquhmdyw', name: 'BRUSH SANDER', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/BRUSH%20SANDER.png' },
  { id: 'e312s0bui', name: 'CURVE SANDER', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CURVE%20SANDER.png' },
  { id: 'e3x70n692', name: 'CURTAINE COATER', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CURTAINE%20COATER.png' },
  { id: 'fmvnn0f3v', name: 'OVEN 2', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/OVEN.png' },
  { id: 'iy9hwjvzy', name: 'MOLDER MACHINE', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/MOLDER%20MACHINE.png' },
  { id: 'j7r7263jd', name: 'CROSS CUTTER 2', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CROSS%20CUTTER%201.png' },
  { id: 'jkrsmv7ze', name: 'PAINT BOOTH 2', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/PAINT%20BOOTH.png' },
  { id: 'kqs6ew1wp', name: 'PAINT MACHINE 2', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/PAINT%20MACHINE.png' },
  { id: 'lcqr7y7h9', name: 'TWO SIDE PLANNER NEW', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/TWO%20SIDE%20PLANNER.png' },
  { id: 'lnwtlub6i', name: 'PAINT MACHINE 1', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/PAINT%20MACHINE.png' },
  { id: 'mc3zwngl8', name: 'CROSS CUTTER 3', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CROSS%20CUTTER%201.png' },
  { id: 'mcxf974b3', name: 'FOUR SIDE PLANNER', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/FOUR%20SIDE%20PLANNER.png' },
  { id: 'mmr77ogz8', name: 'TWO SIDE PLANNER OLD', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/TWO%20SIDE%20PLANNER.png' },
  { id: 'nayknko41', name: 'PAINT BOOTH 1', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/PAINT%20BOOTH.png' },
  { id: 'pswdrkq9f', name: 'RIP SAW (MULTI)', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/RIP%20SAW%20(MULTI).png' },
  { id: 'qp4cyrjf2', name: 'CROSS CUTTER 4', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CROSS%20CUTTER%201.png' },
  { id: 't97emv5lh', name: 'CLAMPING MACHINE', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/WOOD%20CLAMPING%20MACHINE.png' },
  { id: 'tpvputw0h', name: 'DIGITAL WEIGHT MACHINE 1', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/DIGITAL%20WEIGHT%20MACHINE.png' },
  { id: 'uetwn2c3o', name: 'PAINT BOOTH NEW', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/PAINT%20BOOTH%20NEW.png' },
  { id: 'us0dkzf8l', name: 'WIDE BELT SANDER (HOMAG)', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/WIDE%20BELT%20SANDER%20(HOMAG).png' },
  { id: 'v8cnzhtg4', name: 'OVEN 1', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/OVEN.png' },
  { id: 'vv7ubdvp1', name: 'V SAW NEW', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/VARIETY%20SAW.png' },
  { id: 'vxz8i1hkl', name: 'BELT SANDER', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/BELT%20SANDER.png' },
  { id: 'wpf6yqcwj', name: 'MORTIZER', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/MORTIZER.png' },
  { id: 'wzckay5ef', name: 'FINGER JOINT MACHINE', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/FINGER%20JOINT%20MACHINE.png' },
  { id: 'x7nqxpthr', name: 'SPINDLE MOULDER', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/SPINDLE%20MOULDER.png' },
  { id: 'x9ukym2fm', name: 'CALIBRATING SANDER (OPERA 5)', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CALIBRATING%20SANDER%20(OPERA%205).png' },
  { id: 'yxl9vztyq', name: 'MULTI HEAD BORER', department: 'Solid', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/MULTI%20HEAD%20BORER.png' },

  // Sofa Division
  { id: '55d2ilyhf', name: 'BAND SAW 1', department: 'Sofa', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/BAND%20SAW.png' },
  { id: '5vj9wlnxf', name: 'CROSS CUTTER', department: 'Sofa', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CROSS%20CUTTER%201.png' },
  { id: 'j4l3tuar7', name: 'BAND SAW 2', department: 'Sofa', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/BAND%20SAW.png' },
  { id: 'rdvuvuf2n', name: 'SEWING MACHINES', department: 'Sofa', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/SEWING%20MACHINE.png' },
  { id: 'z0r2xbcmi', name: 'CNC BEAM SAW (SCM)', department: 'Sofa', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CNC%20BEAM%20SAW%20SCM.png' },

  // Other Division
  { id: '0mmiiumbd', name: 'WATER PUMP SYSTEM', department: 'Other', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/WATER%20PUMP%20SYSTEM.png' },
  { id: '0ukfmke68', name: 'NEW GENERATOR', department: 'Other', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/GENERATOR.png' },
  { id: '2iyqqpcw7', name: 'COMPRESSOR', department: 'Other', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/COMPRESSOR.png' },
  { id: '82mgnufs4', name: 'FORKLIFT', department: 'Other', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/FORKLIFT.png' },
  { id: '8kr8b0zc3', name: 'AC SERVICE', department: 'Other', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/AC.png' },
  { id: 'bo8vs2ary', name: 'OLD GENERATOR', department: 'Other', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/GENERATOR.png' },
  { id: 'flonhcfsv', name: 'LIGHT REPAIR', department: 'Other', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/LED.png' },
  { id: 'kr0iq5r5a', name: 'CCTV SYSTEM', department: 'Other', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/CCTV%20SYSTEM.png' },
  { id: 'qzik8stzm', name: 'STACKER', department: 'Other', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/STACKER.png' },
  { id: 's54yi95p2', name: 'HAND FORKLIFT', department: 'Other', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/HAND%20FORKLIFT.png' },
  { id: 'vc34esr8p', name: 'PNEUMATIC REPAIR', department: 'Other', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/pneumatic%20.png' },
  { id: 'xqptru0u5', name: 'FIRE PUMP SYSTEM', department: 'Other', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/FIRE%20PUMP%20SYSTEM.png' },
  { id: 'vy60ghflw', name: 'DUST COLLECTOR', department: 'Other', image: 'https://raw.githubusercontent.com/anjanaiz/image/refs/heads/main/DUST%20COLLECTOR.png' },
];

export const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Admin User', role: 'Admin' },
  { id: 'u2', name: 'Supervisor User', role: 'Supervisor' },
  { id: 'u3', name: 'Maintainer User', role: 'Maintainer' },
];

export const APP_THEME = {
  primary: '#D32F2F', // SINGER RED
  textOnPrimary: '#FFFFFF',
  secondary: '#FFFFFF',
  textSecondary: '#333333',
};

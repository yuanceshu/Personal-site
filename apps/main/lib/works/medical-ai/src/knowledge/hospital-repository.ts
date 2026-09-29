import generalSurgeryDepartment from '../../knowledge/hospital/departments/general-surgery.json';
import ctProcess from '../../knowledge/hospital/examinations/ct-process.json';
import openingHours from '../../knowledge/hospital/services/opening-hours.json';
import parking from '../../knowledge/hospital/services/parking.json';
import generalSurgeryLocation from '../../knowledge/hospital/locations/general-surgery.json';
import imagingCenterLocation from '../../knowledge/hospital/locations/imaging-center.json';
import type { KnowledgeEntry } from './types';

export const hospitalKnowledge: KnowledgeEntry[] = [
  generalSurgeryDepartment,
  ctProcess,
  openingHours,
  parking,
  generalSurgeryLocation,
  imagingCenterLocation,
];

export function listHospitalKnowledge(): KnowledgeEntry[] {
  return structuredClone(hospitalKnowledge);
}

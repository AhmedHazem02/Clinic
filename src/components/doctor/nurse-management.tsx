"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, MoreHorizontal, ShieldAlert, Trash2 } from "lucide-react";
import { AddNurseDialog } from "./add-nurse-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Mock data - in a real app, this would come from your backend
const initialNurses = [
    { id: '1', email: 'nurse.jackie@clinic.com', role: 'Nurse' },
    { id: '2', email: 'nurse.smith@clinic.com', role: 'Nurse' },
]

export function NurseManagement() {
    const [isAddNurseOpen, setIsAddNurseOpen] = useState(false);
    const [nurses, setNurses] = useState(initialNurses);

    const handleNurseAdded = () => {
        // Here you would refetch the list of nurses from your database
        // For now, we'll just log a message
        console.log("A new nurse was added. Refreshing list...");
    }

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Nurse Accounts</CardTitle>
                <CardDescription>
                    Manage login accounts for your nursing staff.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {nurses.map((nurse) => (
                             <TableRow key={nurse.id}>
                                <TableCell className="font-medium">{nurse.email}</TableCell>
                                <TableCell>{nurse.role}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem>
                                                <ShieldAlert /> Reset Password
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive">
                                                <Trash2 /> Delete Account
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter>
                 <Button onClick={() => setIsAddNurseOpen(true)}>
                    <UserPlus />
                    Add Nurse
                </Button>
            </CardFooter>
        </Card>
        <AddNurseDialog 
            isOpen={isAddNurseOpen}
            setIsOpen={setIsAddNurseOpen}
            onNurseAdded={handleNurseAdded}
        />
        </>
    )
}
